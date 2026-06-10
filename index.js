const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// جلب مسار قاعدة البيانات من بيئة تشغيل سيرفر Railway الآمنة
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Connected to MongoDB Successfully"))
    .catch(err => console.error("MongoDB initial connection error:", err));
} else {
    console.warn("Warning: MONGO_URI environment variable is missing.");
}

// هيكل قاعدة البيانات لحفظ البيانات مشفرة بالكامل بـ Hercules + VM
const scriptSchema = new mongoose.Schema({
    scriptName: { type: String, required: true },
    scriptKey: { type: String, required: true, unique: true },
    scriptContent: { type: String, required: true }, 
    createdAt: { type: Date, default: Date.now }
});

const Script = mongoose.model('Script', scriptSchema);

/**
 * دالة تشغيل التشفير الكامل لـ Hercules من داخل مجلد [obfuscator]
 */
function obfuscateLuaCode(rawCode) {
    return new Promise((resolve, reject) => {
        const obfuscatorDir = path.join(__dirname, 'obfuscator');
        
        // توليد اسم عشوائي وفريد للملف المؤقت لتفادي تداخل الطلبات المتزامنة
        const fileId = Math.random().toString(36).substring(7);
        const tempInputName = `temp_${fileId}.lua`;
        const tempOutputName = `temp_${fileId}_obfuscated.lua`;

        const tempInputPath = path.join(obfuscatorDir, tempInputName);
        const tempOutputPath = path.join(obfuscatorDir, tempOutputName);

        // 1. كتابة الكود النقي في المجلد الفرعي للتشفير
        fs.writeFileSync(tempInputPath, rawCode, 'utf8');

        // 2. استدعاء hercules.lua مع تحديد مجلد العمل (cwd) لتقرأ لغة ليركوليز ملفاتها وإعداداتها بشكل صحيح
        exec(`lua hercules.lua ${tempInputName}`, { cwd: obfuscatorDir }, (error, stdout, stderr) => {
            // حذف ملف المدخلات النقي فوراً لحماية تامة للسورس كود
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);

            if (error) {
                console.error("Hercules Obfuscation CLI Error:", stderr || stdout);
                if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
                return reject("فشل في معالجة وتشفير الكود عبر محرك Hercules الـ VM.");
            }

            // 3. قراءة الكود المحمي والمشفر الناتج عن المنظومة بالكامل
            if (fs.existsSync(tempOutputPath)) {
                const obfuscatedResult = fs.readFileSync(tempOutputPath, 'utf8');
                fs.unlinkSync(tempOutputPath); // تنظيف وتطهير ملف المخرجات المؤقت
                resolve(obfuscatedResult);
            } else {
                reject("لم يتم العثور على مخرجات التشفير النهائية؛ يرجى التحقق من إعدادات الحزمة.");
            }
        });
    });
}

// Endpoint: استقبال وتشفير وحفظ السكربت تلقائياً
app.post('/api/upload', async (req, res) => {
    try {
        const { scriptName, scriptKey, scriptContent } = req.body;

        if (!scriptName || !scriptKey || !scriptContent) {
            return res.status(400).json({ error: "جميع الحقول مطلوبة لتأمين السكربت." });
        }

        const existingScript = await Script.findOne({ scriptKey });
        if (existingScript) {
            return res.status(400).json({ error: "هذا المفتاح (Key) مستخدم بالفعل لسكربت آخر." });
        }

        console.log(`[🔒 Hercules VM Pipeline] Processing and encrypting: ${scriptName}`);
        
        // تمرير الكود عبر دالة التشفير الشاملة
        let finalProtectedCode;
        try {
            finalProtectedCode = await obfuscateLuaCode(scriptContent);
        } catch (obfError) {
            return res.status(500).json({ error: obfError });
        }

        // حفظ الكود المشفر في قاعدة البيانات دقة 100%
        const newScript = new Script({ 
            scriptName, 
            scriptKey, 
            scriptContent: finalProtectedCode 
        });
        await newScript.save();

        res.status(200).json({ message: "تم التشفير بـ Hercules VM وحفظه سحابياً بنجاح!" });
    } catch (error) {
        console.error("Internal Server Error:", error);
        res.status(500).json({ error: "حدث خطأ داخلي في الخادم أثناء معالجة البيانات." });
    }
});

// Endpoint: التحقق من المفتاح وجلب السكربت المشفر (مع حظر المتصفحات تماماً لحماية السورس)
app.get('/api/check-key', async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).send('-- Error: Key parameter is required');
        }

        const userAgent = req.headers['user-agent'] || '';

        // منع المتصفحات من رؤية السورس كود
        if (!userAgent.includes('Roblox')) {
            console.warn(`[⚠️ Unauthorized Attempt] Blocked browser user-agent: ${userAgent}`);
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.status(403).send('-- [🛡️ Lord Zayro Shield]: Access Denied. Browsers are completely blocked from viewing this core source.');
        }

        const foundScript = await Script.findOne({ scriptKey: key });
        if (!foundScript) {
            return res.status(404).send('-- Error: Invalid or expired key');
        }

        // تسليم الكود المشفر المحمي بالكامل للـ Executor مباشرة
        res.set('Content-Type', 'text/plain');
        res.status(200).send(foundScript.scriptContent);
    } catch (error) {
        console.error("Error checking key:", error);
        res.status(500).send('-- Error: Internal Server Error');
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hercules Shield Main Server is running smoothly on port ${PORT}`);
});
