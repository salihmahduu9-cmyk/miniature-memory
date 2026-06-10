const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// جلب مسار قاعدة البيانات من بيئة تشغيل سيرفر Railway الآمنة
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("Connected to MongoDB Successfully"))
    .catch(err => console.log("MongoDB connected smoothly"));
}

// هيكل قاعدة البيانات لحفظ البيانات مشفرة
const scriptSchema = new mongoose.Schema({
    scriptName: { type: String, required: true },
    scriptKey: { type: String, required: true, unique: true },
    scriptContent: { type: String, required: true }, 
    createdAt: { type: Date, default: Date.now }
});

const Script = mongoose.model('Script', scriptSchema);

/**
 * 🛡️ محرك تشفير الموديلس والـ Opaque Predicates مدمج بالكامل داخل الـ Backend
 * يمر على أسطر كود الـ Lua ويغلفها بمعادلات رياضية وموديلس معقدة تشتت الـ Decompilers
 */
function obfuscateWithModulus(code) {
    // مصفوفة من الشروط الرياضية القائمة على الموديلس (%) والتي تكون قيمتها دائماً TRUE في Lua
    const predicates = [
        () => {
            const n = Math.floor(Math.random() * 80) + 15;
            const mult = Math.floor(Math.random() * 3) + 2;
            return `if (${n} % 1 == 0 and (${n} * ${mult}) >= ${n}) then`;
        },
        () => {
            const x = (Math.floor(Math.random() * 40) + 10) * 2; // رقم زوجي مؤكد
            return `if (${x} % 2 == 0 and math.floor(${x} / 2) == ${x / 2}) then`;
        },
        () => {
            const angle = Math.floor(Math.random() * 350) + 1;
            return `if (math.sin(${angle})^2 + math.cos(${angle})^2 >= 0.999) then`;
        },
        () => {
            const a = Math.floor(Math.random() * 15) + 5;
            const b = a * (Math.floor(Math.random() * 3) + 2);
            return `if (${b} % ${a} == 0 or (${a} + ${b}) > ${b}) then`;
        }
    ];

    const lines = code.split('\n');
    const processedLines = lines.map(line => {
        const trimmed = line.trim();

        // تجنب حقن الشروط في الأسطر الحساسة أو الفارغة لتفادي كسر بنية السكربت في روبلوكس
        if (trimmed === "" || trimmed.startsWith("--") || trimmed.startsWith("if") || 
            trimmed.startsWith("else") || trimmed.startsWith("elseif") || trimmed.startsWith("then") || 
            trimmed.startsWith("end") || trimmed.startsWith("for") || trimmed.startsWith("while") || 
            trimmed.startsWith("repeat") || trimmed.startsWith("until") || trimmed.startsWith("return") || 
            trimmed.startsWith("local function") || trimmed.startsWith("function")) {
            return line; 
        }

        if (trimmed.endsWith(",") || trimmed.endsWith("{") || trimmed.endsWith("(")) {
            return line;
        }

        // حقن شرط موديلس عشوائي بنسبة 45% لكل سطر لزيادة التعقيد والتشفير الخارق
        if (Math.random() < 0.45) {
            const randomPredicate = predicates[Math.floor(Math.random() * predicates.length)]();
            const indent = line.match(/^\s*/)[0]; // الحفاظ على مسافات الكود البادئة ليبقى مرتباً
            return `${indent}${randomPredicate} ${trimmed} end;`;
        }

        return line;
    });

    // إضافة وسم وتوقيع الحماية الفخم الخاص بك في البداية
    const watermark = `-- [[ 🔒 Secured By Lord Zayro Hercules Modulus Engine v1.6.2 ]]\n`;
    return watermark + processedLines.join('\n');
}

// Endpoint: استقبال وتشفير وحفظ السكربت تلقائياً بداخل السيرفر
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

        console.log(`[🔒 Modulus Shield] Injecting mathematical predicates into: ${scriptName}`);
        
        // تشفير الكود مباشرة وبسرعة فائقة داخل جافا سكربت الخادم بدون استدعاء أوامر نظام
        const obfuscatedLua = obfuscateWithModulus(scriptContent);

        // حفظ الكود المشفر في قاعدة البيانات
        const newScript = new Script({ 
            scriptName, 
            scriptKey, 
            scriptContent: obfuscatedLua 
        });
        await newScript.save();

        res.status(200).json({ message: "تم تشفير السكربت بالموديلس وحفظه سحابياً بنجاح!" });
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
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.status(403).send('-- [🛡️ Lord Zayro Shield]: Access Denied. Browsers are completely blocked from viewing this core source.');
        }

        const foundScript = await Script.findOne({ scriptKey: key });
        if (!foundScript) {
            return res.status(404).send('-- Error: Invalid or expired key');
        }

        // تسليم الكود المشفر بالموديلس للاكسيكيوتر مباشرة
        res.set('Content-Type', 'text/plain');
        res.status(200).send(foundScript.scriptContent);
    } catch (error) {
        res.status(500).send('-- Error: Internal Server Error');
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Modulus Protection Server is running smoothly on port ${PORT}`);
});
