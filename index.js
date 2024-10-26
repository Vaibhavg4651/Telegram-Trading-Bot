import express, { json } from 'express';
import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { createLogger, format as _format, transports as _transports } from 'winston';
import { connect } from 'ngrok';

// Load environment variables
config();

// Configure logging
const logger = createLogger({
    format: _format.combine(
        _format.timestamp(),
        _format.printf(({ timestamp, level, message }) => {
            return `${timestamp} - ${level}: ${message}`;
        })
    ),
    transports: [
        new _transports.Console(),
        new _transports.File({ filename: 'error.log', level: 'error' }),
        new _transports.File({ filename: 'combined.log' })
    ]
});

// Constants
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 5000;

const app = express();
app.use(json());

// Create bot instance
const bot = new TelegramBot(TOKEN, { polling: false });



const handleEnd = async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "Ending conversation...");
};

const handleMessage = async (msg) => {
    // Implement your message handling logic here
    const chatId = msg.chat.id;
    if (!msg.text.startsWith('/')) {
        await bot.sendMessage(chatId, `Received your message: ${msg.text}`);
    }
};

// Setup webhook
async function setupWebhook(publicUrl) {
    try {
        const webhookUrl = `${publicUrl}/telegram`;
        await bot.setWebHook(webhookUrl);
        logger.info(`Webhook set up at ${webhookUrl}`);
    } catch (error) {
        logger.error(`Failed to set webhook: ${error.message}`);
        throw error;
    }
}

// Health check function
async function healthCheck(publicUrl) {
    while (true) {
        try {
            const response = await axios.get(`${publicUrl}/wake-up`);
            if (response.status === 200) {
                logger.info("Health check successful");
            } else {
                logger.warn(`Health check failed with status code: ${response.status}`);
            }
        } catch (error) {
            logger.error(`Health check failed: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 840000)); // 14 minutes
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({ Hello: "World" });
});

app.get('/wake-up', (req, res) => {
    res.json({ status: "awake" });
});

app.post('/telegram', async (req, res) => {
    try {
        const update = req.body;
        
        // Handle bot commands and messages
        if (update.message) {
            const msg = update.message;
            
            if (msg.text) {
                if (msg.text === '/end') {
                    await handleEnd(msg);
                } else {
                    await handleMessage(msg);
            }
        }
      }
        res.status(200).send();
    } catch (error) {
        logger.error(`Error processing webhook: ${error.message}`);
        res.status(500).send();
    }
});

// Start server
async function main() {
    try {
        const publicUrl = await connect(PORT);
        logger.info(`ngrok tunnel "${publicUrl}" -> "http://127.0.0.1:${PORT}"`);

        await setupWebhook(publicUrl);
        healthCheck(publicUrl); // Start health check in background

        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}


main();
