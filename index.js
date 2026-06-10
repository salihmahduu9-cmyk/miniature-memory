const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// الاتصال بقاعدة البيانات عبر متغيرات البيئة الآمنة في فيرسل
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => console.log("Connected to MongoDB Successfully"))
      .catch(err => console.error("MongoDB connection error:", err));
} else {
    console.warn("Warning: MONGO_URI environment variable is missing.");
}

// تعريف موديل السكربتات في قاعدة البيانات
const ScriptSchema = new mongoose.Schema({
    scriptName: { type: String, required: true, unique: true },
    scriptContent: { type: String, required: true },
    authKey: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
});

const Script = mongoose.models.Script || mongoose.model('Script', ScriptSchema);

// 1. API رفع وتحديث السكربتات من لوحة التحكم
app.post('/api/upload', async (req, res) => {
    const { scriptName, scriptContent, authKey, isActive } = req.body;
    try {
        if (!scriptName || !scriptContent || !authKey) {
            return res.status(400).json({ success: false, error: "جميع الحقول مطلوبة" });
        }
        
        let script = await Script.findOne({ scriptName });
        if (script) {
            script.scriptContent = scriptContent;
            script.authKey = authKey;
            script.isActive = isActive;
            script.updatedAt = Date.now();
            await script.save();
            return res.json({ success: true, message: "تم تحديث السكربت بنجاح !" });
        } else {
            script = new Script({ scriptName, scriptContent, authKey, isActive });
            await script.save();
            return res.json({ success: true, message: "تم رفع ونشر السكربت الجديد بنجاح آمن!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. API التحقق وجلب السكربت مخصص للاكسيكيوتر فقط مع منع المتصفحات
app.get('/api/get-script', async (req, res) => {
    const scriptName = req.query.name;
    const clientKey = req.headers['x-auth-key'];
    const userAgent = req.headers['user-agent'] || '';

    // نظام منع وحظر المتصفحات العادية من استعراض الكود
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');
    if (isBrowser) {
        return res.status(403).send("ليش داخل؟ ههههههههههههههه");
    }

    try {
        const script = await Script.findOne({ scriptName });
        if (!script) return res.status(404).send("-- السكربت غير موجود");
        if (!script.isActive) return res.status(403).send("-- السكربت معطل");
        if (script.authKey !== clientKey) return res.status(401).send("-- خطا");

        // إرجاع الكود نقي ومباشر للاكسيكيوتر
        res.setHeader('Content-Type', 'text/plain');
        res.send(script.scriptContent);
    } catch (error) {
        res.status(500).send("-- خطا");
    }
});

module.exports = app;
