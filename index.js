const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// تفعيل حزم الدعم وقراءة البيانات الممررة
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// جلب رابط الاتصال بقاعدة البيانات من متغيرات البيئة الآمنة
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000 
    })
    .then(() => console.log("Connected to MongoDB Successfully"))
    .catch(err => console.error("MongoDB initial connection error:", err));
} else {
    console.warn("Warning: MONGO_URI environment variable is missing.");
}

// تعريف هيكل بيانات السكربتات داخل قاعدة البيانات (Schema)
const scriptSchema = new mongoose.Schema({
    scriptName: { type: String, required: true },
    scriptKey: { type: String, required: true, unique: true },
    scriptContent: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Script = mongoose.model('Script', scriptSchema);

// Endpoint: استقبال وحفظ السكربت الجديد من لوحة التحكم
app.post('/api/upload', async (req, res) => {
    try {
        const { scriptName, scriptKey, scriptContent } = req.body;

        if (!scriptName || !scriptKey || !scriptContent) {
            return res.status(400).json({ error: "جميع الحقول مطلوبة لتأمين السكربت." });
        }

        // التحقق من عدم تكرار المفتاح
        const existingScript = await Script.findOne({ scriptKey });
        if (existingScript) {
            return res.status(400).json({ error: "هذا المفتاح (Key) مستخدم بالفعل لسكربت آخر." });
        }

        const newScript = new Script({ scriptName, scriptKey, scriptContent });
        await newScript.save();

        res.status(200).json({ message: "تم رفع ونشر السكربت الجديد بنجاح آمن!" });
    } catch (error) {
        console.error("Error uploading script:", error);
        res.status(500).json({ error: "حدث خطأ داخلي في الخادم أثناء الحفظ." });
    }
});

// Endpoint: التحقق من المفتاح وجلب السكربت للاكسيكيوتر (Loader)
app.get('/api/check-key', async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).send('-- Error: Key parameter is required');
        }

        const foundScript = await Script.findOne({ scriptKey: key });
        if (!foundScript) {
            return res.status(404).send('-- Error: Invalid or expired key');
        }

        // إرسال كود الـ Lua البرمجي النقي للاكسيكيوتر مباشرة
        res.set('Content-Type', 'text/plain');
        res.status(200).send(foundScript.scriptContent);
    } catch (error) {
        console.error("Error checking key:", error);
        res.status(500).send('-- Error: Internal Server Error');
    }
});

// توجيه أي مسار آخر لواجهة المستخدم
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تحديد المنفذ الديناميكي لتشغيل السيرفر على Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
