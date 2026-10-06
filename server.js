require('dotenv').config({ quiet: true });
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('src'));

mongoose.connect('mongodb://127.0.0.1:27017/emaildb')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

const Contact = mongoose.model('Contact', {
    lastName: String,
    firstName: String,
    middleName: String,
    email: String
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ lastName: 1, firstName: 1 });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: 'Помилка отримання списку' });
    }
});

app.post('/api/contacts', async (req, res) => {
    try {
        const newContact = new Contact(req.body);
        await newContact.save();
        res.status(201).end();
    } catch (err) {
        res.status(500).json({ error: 'Помилка збереження' });
    }
});

app.put('/api/contacts/:id', async (req, res) => {
    try {
        const updated = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).end();
    } catch (err) {
        res.status(500).json({ error: 'Помилка оновлення' });
    }
});

app.delete('/api/contacts/:id', async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.status(200).end();
    } catch (err) {
        res.status(500).json({ error: 'Помилка видалення' });
    }
});

app.post('/api/send-mail', async (req, res) => {
    const subject = req.body.subject;
    const text = req.body.text;

    if (!text) {
        return res.status(400).json({ error: 'Текст листа не може бути порожнім' });
    }

    if (!subject) {
        return res.status(400).json({ error: 'Тема листа не може бути порожньою' });
    }

    try {
        const contacts = await Contact.find();
        if (contacts.length === 0) {
            return res.status(400).json({ error: 'Список контактів порожній' });
        }

        let sentCount = 0;
        const failedEmails = [];

        for (let contact of contacts) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: contact.email,
                    subject: subject,
                    text: text
                });
                sentCount++;
            } catch (mailErr) {
                console.error(`Помилка надсилання на ${contact.email}:`, mailErr.message);
                failedEmails.push(contact.email);
            }
        }

        if (failedEmails.length > 0) {
            res.json({
                message: `Надіслано листів: ${sentCount}. Не вдалося надіслати на адреси: ${failedEmails.join(', ')}`,
                sentCount,
                failedEmails
            });
        } else {
            res.json({
                message: `Надіслано листів: ${sentCount}`,
                sentCount
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущено: http://localhost:${PORT}`);
});
