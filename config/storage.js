
// config/storage.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'pongola_products', // Or whatever folder you want
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [{ width: 600, height: 600, crop: 'limit' }]
    }
});

const upload3 = multer({ storage });
module.exports = upload3;
