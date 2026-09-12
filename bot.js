// ============================================================
// HDM TELEGRAM BOT - Webhook Mode (Chống 409 Conflict)
// Author: HDM
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ===== CẤU HÌNH =====
const BOT_TOKEN = '8708745866:AAHaguQ0pucXCWuaGWN-lJCUofx45p2v84U';
const ADMIN_ID = 6780308119;
const KEY_PRICE = 5000;
const BANK_INFO = {
    bank: 'VPBank',
    account: '6566221227',
    owner: 'DO HAI DANG'
};
const TELEGRAM_SUPPORT = '@spmxhhdm';

// ===== CÔNG THỨC TẠO KEY =====
const SECRET_A = 7919;
const SECRET_B = 2026;
const SECRET_C = 104729;

function generateKey() {
    const xxxx = String(Math.floor(Math.random() * 90000) + 10000);
    const yyyy = String((parseInt(xxxx) * SECRET_A + SECRET_B) % SECRET_C).padStart(5, '0').slice(-5);
    return `HDM-${xxxx}-${yyyy}`;
}

// ===== DATABASE =====
const DB_FILE = path.join(__dirname, 'bot_keys.json');

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({ pending: {}, keys: [] }, null, 2));
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('DB load error:', e);
        return { pending: {}, keys: [] };
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB save error:', e);
    }
}

// ===== EXPRESS SERVER =====
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// ===== BOT (WEBHOOK MODE) =====
const bot = new TelegramBot(BOT_TOKEN);

// Set webhook
const webhookPath = `/bot${BOT_TOKEN}`;
bot.setWebHook(`${WEBHOOK_URL}${webhookPath}`)
    .then(() => {
        console.log(`✅ Webhook set: ${WEBHOOK_URL}${webhookPath}`);
    })
    .catch((err) => {
        console.error('❌ Webhook error:', err.message);
    });

// Nhận update từ Telegram
app.post(webhookPath, (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (e) {
        console.error('Process update error:', e);
        res.sendStatus(500);
    }
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        bot: '@hdm_key_bot',
        mode: 'webhook',
        time: new Date().toISOString()
    });
});

// ===== LỆNH /start =====
bot.onText(/\/start/, (msg) => {
    try {
        const chatId = msg.chat.id;
        const name = msg.from.first_name || 'bạn';
        
        bot.sendMessage(chatId, 
            `👋 Xin chào *${name}*!\n\n` +
            `🔑 *HDM KEY BOT*\n\n` +
            `💰 Giá: *5.000đ/key*\n` +
            `💳 Ngân hàng: *${BANK_INFO.bank}*\n` +
            `🔢 STK: \`${BANK_INFO.account}\`\n` +
            `👤 Chủ TK: *${BANK_INFO.owner}*\n\n` +
            `📌 *Hướng dẫn:*\n` +
            `1️⃣ Chuyển 5.000đ vào STK trên\n` +
            `2️⃣ Chụp bill → gửi vào đây\n` +
            `3️⃣ Chờ admin duyệt → nhận key\n\n` +
            `⏰ Key sẽ tự động thu hồi sau 1 phút\n` +
            `📱 Hỗ trợ: ${TELEGRAM_SUPPORT}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Start error:', e);
    }
});

// ===== LỆNH /help =====
bot.onText(/\/help/, (msg) => {
    try {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            `📖 *HƯỚNG DẪN SỬ DỤNG*\n\n` +
            `1. Chuyển khoản 5.000đ vào:\n` +
            `   • Ngân hàng: ${BANK_INFO.bank}\n` +
            `   • STK: \`${BANK_INFO.account}\`\n` +
            `   • Chủ TK: ${BANK_INFO.owner}\n\n` +
            `2. Chụp ảnh bill chuyển khoản\n` +
            `3. Gửi ảnh vào bot này\n` +
            `4. Chờ admin duyệt (1-5 phút)\n` +
            `5. Nhận key → nhập vào tool\n\n` +
            `⚠️ *Lưu ý:*\n` +
            `• Key chỉ dùng được 1 lần\n` +
            `• Key bị thu hồi sau 1 phút\n` +
            `• Copy key ngay khi nhận\n\n` +
            `📱 Hỗ trợ: ${TELEGRAM_SUPPORT}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Help error:', e);
    }
});

// ===== NHẬN BILL TỪ USER =====
bot.on('photo', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const username = msg.from.username || msg.from.first_name || 'Unknown';
        
        if (chatId === ADMIN_ID) return;
        
        const db = loadDB();
        const pendingId = `pending_${Date.now()}_${chatId}`;
        db.pending[pendingId] = {
            chatId: chatId,
            username: username,
            photoId: msg.photo[msg.photo.length - 1].file_id,
            time: new Date().toISOString()
        };
        saveDB(db);
        
        bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
            caption: `🔔 *BILL MỚI*\n\n` +
                     `👤 User: @${username}\n` +
                     `🆔 Chat ID: \`${chatId}\`\n` +
                     `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
                     `Bấm nút bên dưới để cấp key:`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ CẤP KEY', callback_data: `approve_${pendingId}` },
                    { text: '❌ TỪ CHỐI', callback_data: `reject_${pendingId}` }
                ]]
            }
        });
        
        bot.sendMessage(chatId, 
            `✅ *Đã nhận bill!*\n\n` +
            `⏳ Chờ admin duyệt... (1-5 phút)\n` +
            `📱 Hỗ trợ: ${TELEGRAM_SUPPORT}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Photo handler error:', e);
    }
});

// ===== ADMIN DUYỆT =====
bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;
        const data = query.data;
        
        if (chatId !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: '❌ Bạn không có quyền!' });
            return;
        }
        
        const db = loadDB();
        
        if (data.startsWith('approve_')) {
            const pendingId = data.replace('approve_', '');
            const pending = db.pending[pendingId];
            
            if (!pending) {
                bot.answerCallbackQuery(query.id, { text: '❌ Không tìm thấy!' });
                return;
            }
            
            const newKey = generateKey();
            db.keys.push({
                key: newKey,
                chatId: pending.chatId,
                username: pending.username,
                created: new Date().toISOString(),
                used: false
            });
            delete db.pending[pendingId];
            saveDB(db);
            
            bot.sendMessage(pending.chatId, 
                `🔑 *KEY CỦA BẠN*\n\n` +
                `\`${newKey}\`\n\n` +
                `⏰ Tin nhắn này sẽ tự xóa sau 1 phút\n` +
                `📌 Nhập key vào tool để sử dụng\n\n` +
                `⚠️ Copy key ngay!`,
                { parse_mode: 'Markdown' }
            ).then((sentMsg) => {
                setTimeout(() => {
                    bot.deleteMessage(pending.chatId, sentMsg.message_id)
                        .catch(() => console.log('Không thể thu hồi tin nhắn'));
                }, 60000);
            });
            
            bot.editMessageCaption(
                `✅ *ĐÃ CẤP KEY*\n\n` +
                `👤 User: @${pending.username}\n` +
                `🆔 Chat ID: \`${pending.chatId}\`\n` +
                `🔑 Key: \`${newKey}\`\n` +
                `⏰ ${new Date().toLocaleString('vi-VN')}`,
                {
                    chat_id: ADMIN_ID,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            
            bot.answerCallbackQuery(query.id, { text: '✅ Đã cấp key!' });
        }
        
        else if (data.startsWith('reject_')) {
            const pendingId = data.replace('reject_', '');
            const pending = db.pending[pendingId];
            
            if (!pending) {
                bot.answerCallbackQuery(query.id, { text: '❌ Không tìm thấy!' });
                return;
            }
            
            bot.sendMessage(pending.chatId, 
                `❌ *Bill không hợp lệ*\n\n` +
                `Vui lòng liên hệ ${TELEGRAM_SUPPORT} để được hỗ trợ.`,
                { parse_mode: 'Markdown' }
            );
            
            delete db.pending[pendingId];
            saveDB(db);
            
            bot.editMessageCaption(
                `❌ *ĐÃ TỪ CHỐI*\n\n` +
                `👤 User: @${pending.username}\n` +
                `🆔 Chat ID: \`${pending.chatId}\``,
                {
                    chat_id: ADMIN_ID,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            
            bot.answerCallbackQuery(query.id, { text: '❌ Đã từ chối!' });
        }
    } catch (e) {
        console.error('Callback error:', e);
    }
});

// ===== LỆNH ADMIN =====
bot.onText(/\/listkeys/, (msg) => {
    try {
        if (msg.chat.id !== ADMIN_ID) return;
        
        const db = loadDB();
        const keys = db.keys.slice(-20);
        
        if (keys.length === 0) {
            bot.sendMessage(ADMIN_ID, '📭 Chưa có key nào.');
            return;
        }
        
        let text = `📋 *20 KEY GẦN NHẤT*\n\n`;
        keys.forEach((k, i) => {
            text += `${i+1}. \`${k.key}\` - ${k.used ? '🔴 Đã dùng' : '🟢 Chưa dùng'}\n`;
        });
        
        bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Listkeys error:', e);
    }
});

bot.onText(/\/stats/, (msg) => {
    try {
        if (msg.chat.id !== ADMIN_ID) return;
        
        const db = loadDB();
        const total = db.keys.length;
        const used = db.keys.filter(k => k.used).length;
        const pending = Object.keys(db.pending).length;
        
        bot.sendMessage(ADMIN_ID,
            `📊 *THỐNG KÊ*\n\n` +
            `🔑 Tổng key: *${total}*\n` +
            `🟢 Chưa dùng: *${total - used}*\n` +
            `🔴 Đã dùng: *${used}*\n` +
            `⏳ Chờ duyệt: *${pending}*\n\n` +
            `💰 Doanh thu ước tính: *${(used * KEY_PRICE).toLocaleString('vi-VN')}đ*`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Stats error:', e);
    }
});

// ===== XỬ LÝ LỖI =====
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

// ===== KHỞI ĐỘNG SERVER =====
app.listen(PORT, () => {
    console.log(`🚀 HDM Bot server chạy tại port ${PORT}`);
    console.log(`🔗 Webhook URL: ${WEBHOOK_URL}${webhookPath}`);
    console.log(`👤 Admin ID: ${ADMIN_ID}`);
    console.log(`💰 Giá key: ${KEY_PRICE.toLocaleString('vi-VN')}đ`);
    console.log(`✅ HDM Bot đã sẵn sàng!`);
});
