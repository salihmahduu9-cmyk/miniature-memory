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

// جلب مسار قاعدة البيانات من بيئة تشغيل سيرفر Railway
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Connected to MongoDB Successfully"))
    .catch(err => console.error("MongoDB initial connection error:", err));
} else {
    console.warn("Warning: MONGO_URI environment variable is missing.");
}

// هيكل البيانات لحفظ السكربتات المشفرة
const scriptSchema = new mongoose.Schema({
    scriptName: { type: String, required: true },
    scriptKey: { type: String, required: true, unique: true },
    scriptContent: { type: String, required: true }, // سيتم حفظ الكود مشفراً هنا
    createdAt: { type: Date, default: Date.now }
});

const Script = mongoose.model('Script', scriptSchema);

/**
 * دالة ذكية لتشغيل ملفات مشروع هيركوليز المرفوعة وتشفير الكود فورياً
 */
function obfuscateLuaCode(rawCode) {
    return new Promise((resolve, reject) => {
        const tempInputPath = path.join(__dirname, 'temp_input.lua');
        const tempOutputPath = path.join(__dirname, 'temp_input_obfuscated.lua');

        // 1. كتابة الكود النقي في ملف مؤقت
        fs.writeFileSync(tempInputPath, rawCode, 'utf8');

        // 2. تشغيل التشفير عبر الـ CLI الخاص بـ hercules.lua المرفوع
        // تأكد من وجود ملف hercules.lua وبقية ملفات الحماية في نفس المجلد الرئيسي للمشروع
        exec(`lua hercules.lua temp_input.lua`, (error, stdout, stderr) => {
            // حذف ملف المدخلات النقي فوراً لأمان السورس كود
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);

            if (error) {
                console.error("Hercules Obfuscation CLI Error:", stderr);
                return reject("فشل في معالجة وتشفير الكود عبر محرك Hercules.");
            }

            // 3. قراءة الكود المشفر بالكامل الناتج من المنظومة
            if (fs.existsSync(tempOutputPath)) {
                const obfuscatedResult = fs.readFileSync(tempOutputPath, 'utf8');
                fs.unlinkSync(tempOutputPath); // تنظيف الملف المؤقت المشفر
                resolve(obfuscatedResult);
            } else {
                reject("لم يتم العثور على مخرجات التشفير المحمية.");
            }
        });
    });
}

// Endpoint: استقبال وتشفير وحفظ السكربت آلياً 🛡️
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

        console.log(`[🔒 Shield Engine] Obfuscating ${scriptName} via Hercules Pipeline...`);
        
        // استدعاء التشفير التلقائي
        let finalProtectedCode;
        try {
            finalProtectedCode = await obfuscateLuaCode(scriptContent);
        } catch (obfError) {
            return res.status(500).json({ error: obfError });
        }

        // حفظ الكود المشفر والـ VM في قاعدة البيانات دقة 100%
        const newScript = new Script({ 
            scriptName, 
            scriptKey, 
            scriptContent: finalProtectedCode 
        });
        await newScript.save();

        res.status(200).json({ message: "تم تشفير السكربت بـ Hercules وحفظه سحابياً بنجاح!" });
    } catch (error) {
        console.error("Internal Server Error:", error);
        res.status(500).json({ error: "حدث خطأ داخلي في الخادم أثناء معالجة البيانات." });
    }
});

// Endpoint: التحقق من المفتاح وجلب السكربت المشفر (مع حظر المتصفحات)
app.get('/api/check-key', async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).send('-- Error: Key parameter is required');
        }

        const userAgent = req.headers['user-agent'] || '';

        // حظر المتصفحات لحماية السكربت والـ VM من التسريب الخارجي
        if (!userAgent.includes('Roblox')) {
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.status(403).send('-- [🛡️ Lord Zayro Shield]: Access Denied. Browsers are completely blocked from viewing this core source.');
        }

        const foundScript = await Script.findOne({ scriptKey: key });
        if (!foundScript) {
            return res.status(404).send('-- Error: Invalid or expired key');
        }

        // تسليم الكود المشفر الجاهز للاكسيكيوتر مباشرة
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
    console.log(`Server is running smoothly on port ${PORT}`);
});
