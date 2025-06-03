const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Assuming this is used elsewhere in the full file
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt'); // Assuming this is used elsewhere in the full file
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();
const upload3 = require('./config/storage');


const morgan = require('morgan');
const compression = require('compression');
const { Client } = require('ssh2');
const helmet = require('helmet');

// __dirname and __filename are available automatically in CommonJS modules

const app = express();
const port = process.env.DB_PORT;
const saltRounds = 10; // Assuming this is used elsewhere

// const db = mysql.createConnection({
const db = mysql.createPool({

    // host: "localhost",
    // user: "root",
    // password: "12345",
    // database: "pongoladb"
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

app.use(helmet());
app.use(morgan('common'));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(bodyParser.json()); // bodyParser.json() is redundant if using express.json() in Express 4.16+

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // __dirname is available here
        const uploadPath = path.join(__dirname, 'src/ID_uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});

const upload = multer({ storage: storage });

// __dirname is available here
const uploadDir = path.join(__dirname, 'uploads');
// Create the uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    // port: 465,
    auth: {
        user: process.env.Email_USER,
        pass: process.env.Email_PASS
    }
});

// const storage2 = multer.diskStorage({
//     destination: function (req, file, cb) {
//         // Store files in the 'uploads' directory
//         cb(null, uploadDir); // uploadDir is already defined using __dirname
//     },
//     filename: function (req, file, cb) {
//         // Generate a unique filename: fieldname-timestamp.ext
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

// Create the multer upload middleware instance
// 'images' is the name of the file input field on the frontend
// const upload2 = multer({
//     storage: storage2,
//     limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB (adjust as needed)
//     fileFilter: (req, file, cb) => {
//         // Accept images only
//         if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
//             return cb(new Error('Only image files (JPG, JPEG, PNG, GIF) are allowed!'), false);
//         }
//         cb(null, true);
//     }
// });

app.get('/', (req, res) => {
    res.json('thought i was going to say hello world ,sike!');
});

app.get('/jss', (req, res) => {
    res.json('am working');
});



// payfast aspects

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE;
// const PAYFAST_URL = 'https://www.payfast.co.za/eng/process';
const PAYFAST_URL = 'https://sandbox.payfast.co.za/eng/process';


const RETURN_URL = 'http://localhost:5173/OrderSuccess';
const CANCEL_URL = 'http://localhost:5173/OrderCanelled';
const NOTIFY_URL = '';


// Sending confirmation
const fsp = require('fs').promises;
async function getEmailHtml(templateName, data) {
    const templatePath = path.join(__dirname, 'templates', templateName);
    let html = await fsp.readFile(templatePath, { encoding: 'utf8' });

    // Replace general placeholders
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(placeholder, data[key]);
        }
    }

    // Handle dynamic item rows
    if (data.items && Array.isArray(data.items)) {
        let itemRowsHtml = '';
        const itemRowTemplate = `
            <tr>
                <td class="item-row" style="padding: 10px 0; border-bottom: 1px solid #eeeeee;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                        <tr>
                            <td width="60" valign="top" style="padding-right: 15px;">
                                <img src="{{itemImage}}" alt="{{itemName}}" width="60" height="60" style="display: block; border-radius: 5px; border: 1px solid #dddddd;">
                            </td>
                            <td valign="top" style="font-size: 14px; color: #333333;">
                                <strong style="color: #000000;">{{itemName}}</strong><br>
                                <span style="font-size: 12px; color: #777777;">Qty: {{itemQty}}</span>
                            </td>
                            <td align="right" valign="top" style="font-size: 14px; font-weight: bold; color: #000000;">
                               R<span>{{itemPrice}}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        `;

        data.items.forEach(item => {
            let currentRowHtml = itemRowTemplate;
            currentRowHtml = currentRowHtml.replace(/{{itemImage}}/g, item.Image_url || 'https://placehold.co/60x60/e0e0e0/000000?text=Product');
            currentRowHtml = currentRowHtml.replace(/{{itemName}}/g, item.ProductName);
            currentRowHtml = currentRowHtml.replace(/{{itemQty}}/g, item.Quantity);
            currentRowHtml = currentRowHtml.replace(/{{itemPrice}}/g, item.SubTotal.toFixed(2)); // Use SubTotal for item price
            itemRowsHtml += currentRowHtml;
        });
        html = html.replace('{{itemRows}}', itemRowsHtml);
    } else {
        html = html.replace('{{itemRows}}', ''); // Remove placeholder if no items
    }

    return html;
}

async function getComprehensiveOrderDetails(orderId) {
    // Fetch main order details and join with user details
    const orderQuery = `
        SELECT
            o.OrderID, o.UserID, o.OrderNumber, o.OrderDate, o.ShippingAddrID, o.BillingAddrID,
            o.TotalAmount, o.OrderStatus, o.PaymentStatus, o.CreatedAt AS OrderCreatedAt, o.UpdatedAt AS OrderUpdatedAt,
            u.Name AS UserName, u.Surname AS UserSurname, u.Email AS UserEmail, u.PhoneNumber AS UserPhone
        FROM gcinumus_PongolaSupplies_db.order o
        JOIN gcinumus_PongolaSupplies_db.user_tb u ON o.UserID = u.UserId
        WHERE o.OrderID = ?;
    `;
    const orderRows = await queryAsync(orderQuery, [orderId]);

    if (orderRows.length === 0) {
        throw new Error('Order not found.');
    }
    const order = orderRows[0];

    // Fetch order items for this order, joining with product_image
    const itemsQuery = `
        SELECT
            oi.ItemId, oi.ProductID, oi.ProductName, oi.ProductDescription, oi.PricePerItem, oi.Quantity, oi.SubTotal, oi.ItemStatus, oi.ShippingTrackerNumber,
            pi.Image_url
        FROM gcinumus_PongolaSupplies_db.order_items oi
        LEFT JOIN gcinumus_PongolaSupplies_db.product_image pi ON oi.ProductID = pi.ProductID
        WHERE oi.OrderID = ?
        ORDER BY pi.SortOrder ASC, pi.ImageId ASC;
    `;
    const items = await queryAsync(itemsQuery, [orderId]);

    // Fetch shipping address details
    let shippingAddress = null;
    if (order.ShippingAddrID) {
        const addressQuery = `
            SELECT AddressId, Address1, Address2, CityOrSuburb, Province, ZipCode, Country, Label, AddressType, CreatedAt
            FROM gcinumus_PongolaSupplies_db.address
            WHERE AddressId = ?;
        `;
        const addressRows = await queryAsync(addressQuery, [order.ShippingAddrID]);
        if (addressRows.length > 0) {
            shippingAddress = addressRows[0];
        }
    }

    // Calculate Delivery Fee and Tax Amount (as per your existing logic)
    const calculatedItemsSubTotal = items.reduce((sum, item) => sum + item.SubTotal, 0);
    let deliveryFee = 0;
    let taxAmount = 0;

    if (order.TotalAmount > calculatedItemsSubTotal) {
        deliveryFee = 2.00; // Example fixed delivery fee
        taxAmount = order.TotalAmount - calculatedItemsSubTotal - deliveryFee;
        if (taxAmount < 0) taxAmount = 0;
    }

    return {
        OrderID: order.OrderID,
        OrderNumber: order.OrderNumber,
        OrderDate: order.OrderDate,
        TotalAmount: order.TotalAmount,
        OrderStatus: order.OrderStatus,
        PaymentStatus: order.PaymentStatus,
        CreatedAt: order.OrderCreatedAt,
        UpdatedAt: order.OrderUpdatedAt,
        deliveryInfo: {
            firstName: order.UserName,
            lastName: order.UserSurname,
            email: order.UserEmail,
            phone: order.UserPhone,
            selectedAddressId: shippingAddress?.AddressId,
            streetAddress: shippingAddress?.Address1 || '',
            Address2: shippingAddress?.Address2 || '',
            postalAddress: shippingAddress?.CityOrSuburb || '',
            state: shippingAddress?.Province || '',
            zipcode: shippingAddress?.ZipCode || '',
            country: shippingAddress?.Country || '',
            addressLabel: shippingAddress?.Label || '',
            addressType: shippingAddress?.AddressType || '',
        },
        items: items,
        deliveryFee: deliveryFee,
        taxAmount: taxAmount,
    };
}
app.post('/api/send-order-confirmation-email', async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required to send confirmation email.' });
    }

    try {
        // 1. Check if email has already been sent for this order
        const checkEmailStatusQuery = `
            SELECT confirmation_email_sent, email_sent_at, UserID, OrderNumber
            FROM gcinumus_PongolaSupplies_db.order
            WHERE OrderID = ?;
        `;
        const orderStatus = await queryAsync(checkEmailStatusQuery, [orderId]);

        if (orderStatus.length === 0) {
            return res.status(404).json({ message: 'Order not found for email confirmation check.' });
        }

        const currentOrder = orderStatus[0];

        if (currentOrder.confirmation_email_sent) {
            console.log(`Email for Order ID ${orderId} already sent at ${currentOrder.email_sent_at}. Skipping re-send.`);
            return res.status(200).json({ message: 'Order confirmation email already sent for this order.', alreadySent: true });
        }

        // If not sent, proceed to fetch full order details and send email
        // *** FIX: Call the new reusable function directly ***
        const order = await getComprehensiveOrderDetails(orderId);

        if (!order || !order.deliveryInfo || !order.items) {
            return res.status(404).json({ message: 'Order details not found for email confirmation.' });
        }

        // 2. Prepare data for the email template (same as before)
        const customerName = `${order.deliveryInfo.firstName} ${order.deliveryInfo.lastName}`;
        const orderDate = new Date(order.CreatedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
        const estimatedDeliveryDate = '5-7 business days'; // Placeholder, calculate if possible

        const billingAddressLine1 = order.deliveryInfo.streetAddress;
        const billingAddressLine2 = `${order.deliveryInfo.Address2 ? order.deliveryInfo.Address2 + ', ' : ''}${order.deliveryInfo.postalAddress}, ${order.deliveryInfo.state} ${order.deliveryInfo.zipcode}, ${order.deliveryInfo.country}`;

        const emailData = {
            customerName: customerName,
            orderNumber: order.OrderNumber,
            orderId: order.OrderID,
            orderDate: orderDate,
            estimatedDeliveryDate: estimatedDeliveryDate,
            paymentMethod: order.PaymentStatus,
            billingName: customerName,
            billingAddressLine1: billingAddressLine1,
            billingAddressLine2: billingAddressLine2,
            deliveryMethod: 'Standard Shipping (5-7 days)',
            itemCost: order.items.reduce((sum, item) => sum + item.SubTotal, 0).toFixed(2),
            shippingCost: order.deliveryFee.toFixed(2),
            taxAmount: order.taxAmount.toFixed(2),
            couponAmount: (0.00).toFixed(2),
            totalCost: order.TotalAmount.toFixed(2),
            currentYear: new Date().getFullYear(),
            continueShoppingLink: process.env.FRONTEND_URL,
            downloadInvoiceLink: `${process.env.FRONTEND_URL}/invoice/${order.OrderID}`,
            trackOrderLink: `${process.env.FRONTEND_URL}/orders/${order.OrderID}`,
            items: order.items
        };

        const emailHtml = await getEmailHtml('order_confirmation_template.html', emailData);

        const mailOptions = {
            from: `Pongola Cleaning Supplies" <${process.env.EMAIL_USER}>`,
            to: order.deliveryInfo.email,
            subject: `Order Confirmation - #${order.OrderNumber} from Pongola Cleaning Supplies`,
            html: emailHtml
        };

        // 3. Send the email
        await transporter.sendMail(mailOptions);

        // 4. Update the database flag after successful sending
        const updateEmailStatusQuery = `
            UPDATE gcinumus_PongolaSupplies_db.order
            SET confirmation_email_sent = TRUE, email_sent_at = NOW()
            WHERE OrderID = ?;
        `;
        await queryAsync(updateEmailStatusQuery, [orderId]);

        res.status(200).json({ message: 'Order confirmation email sent successfully!' });
        console.log('Order confirmation email sent successfully!');


    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        res.status(500).json({ message: 'Failed to send order confirmation email.', error: error.message });
    }
});





// ORDER ENDPOINTS 

const queryAsync = (sql, values) => {
    return new Promise((resolve, reject) => {
        db.query(sql, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};



app.post('/api/orders', async (req, res) => {
    const { UserID, ShippingAddrID, BillingAddrID, TotalAmount, OrderStatus, PaymentStatus } = req.body;

    // Basic validation
    if (!UserID || !ShippingAddrID || !TotalAmount || !OrderStatus || !PaymentStatus) {
        return res.status(400).json({ message: 'Missing required fields for order creation.' });
    }

    const orderNumber = `ORD-${Date.now()}`; // Generate a unique order number

    const query = `
        INSERT INTO gcinumus_PongolaSupplies_db.order
        (UserID, OrderNumber, ShippingAddrID, BillingAddrID, TotalAmount, OrderStatus, PaymentStatus, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const values = [UserID, orderNumber, ShippingAddrID, BillingAddrID, TotalAmount, OrderStatus, PaymentStatus];

    try {
        const result = await queryAsync(query, values);
        res.status(201).json({
            message: 'Order created successfully',
            orderId: result.insertId,
            orderNumber: orderNumber
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
});

// READ All Orders (GET /api/orders)
// Optional: Add query parameters for filtering, pagination, sorting in a real app
app.get('/api/orders', async (req, res) => {
    const query = `SELECT * FROM gcinumus_PongolaSupplies_db.order`;
    try {
        const orders = await queryAsync(query);
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// READ a Specific Order by OrderId (GET /api/orders/:orderId)
// This is the endpoint used by your frontend OrderSuccess page
// app.get('/api/orders/:orderId', async (req, res) => {
//     const orderId = req.params.orderId;

//     try {
//         // Fetch main order details
//         const orderQuery = `
//             SELECT 
//                 o.OrderID, o.UserID, o.OrderNumber, o.OrderDate, o.ShippingAddrID, o.BillingAddrID, 
//                 o.TotalAmount, o.OrderStatus, o.PaymentStatus, o.CreatedAt, o.UpdatedAt,
//                 u.Name AS UserName, u.Surname AS UserSurname, u.Email AS UserEmail, u.PhoneNumber AS UserPhone
//             FROM gcinumus_PongolaSupplies_db.order o
//             JOIN gcinumus_PongolaSupplies_db.user_tb u ON o.UserID = u.UserId
//             WHERE o.OrderID = ?;
//         `;
//         const orderRows = await queryAsync(orderQuery, [orderId]);

//         if (orderRows.length === 0) {
//             return res.status(404).json({ message: 'Order not found.' });
//         }
//         const order = orderRows[0];

//         // Fetch order items for this order
//         const itemsQuery = `
//             SELECT 
//                 ItemId, ProductID, ProductName, ProductDescription, PricePerItem, Quantity, SubTotal, ItemStatus, ShippingTrackerNumber
//             FROM gcinumus_PongolaSupplies_db.order_items
//             WHERE OrderID = ?;
//         `;
//         const items = await queryAsync(itemsQuery, [orderId]);

//         // Fetch shipping address details
//         let shippingAddress = null;
//         if (order.ShippingAddrID) {
//             const addressQuery = `
//                 SELECT Address1, Address2, CityOrSuburb, Province, ZipCode, Country, Label, AddressType
//                 FROM gcinumus_PongolaSupplies_db.address
//                 WHERE AddressId = ?;
//             `;
//             const addressRows = await queryAsync(addressQuery, [order.ShippingAddrID]);
//             if (addressRows.length > 0) {
//                 shippingAddress = addressRows[0];
//             }
//         }

//         // Calculate subtotal from items and derive deliveryFee/tax if not explicitly stored
//         const calculatedSubTotal = items.reduce((sum, item) => sum + item.SubTotal, 0);
//         // Assuming TotalAmount = SubTotal + DeliveryFee + Tax
//         // For simplicity, let's assume deliveryFee and taxAmount are fixed or derived.
//         // In a real app, you'd fetch these if stored per order, or recalculate.
//         // For demonstration, let's just ensure they are present in the response.
//         const deliveryFee = 2.00; // Example fixed delivery fee
//         const taxAmount = 5.00; // Example fixed tax amount

//         const responseData = {
//             OrderID: order.OrderID,
//             OrderNumber: order.OrderNumber,
//             OrderDate: order.OrderDate,
//             TotalAmount: order.TotalAmount,
//             OrderStatus: order.OrderStatus,
//             PaymentStatus: order.PaymentStatus,
//             deliveryInfo: {
//                 firstName: order.UserName,
//                 lastName: order.UserSurname,
//                 email: order.UserEmail,
//                 phone: order.UserPhone,
//                 streetAddress: shippingAddress?.Address1 || '',
//                 Address2: shippingAddress?.Address2 || '', // Ensure Address2 is included
//                 postalAddress: shippingAddress?.CityOrSuburb || '',
//                 state: shippingAddress?.Province || '',
//                 zipcode: shippingAddress?.ZipCode || '',
//                 country: shippingAddress?.Country || '',
//                 addressLabel: shippingAddress?.Label || '',
//                 addressType: shippingAddress?.AddressType || '',
//             },
//             items: items,
//             deliveryFee: deliveryFee, // Include deliveryFee
//             taxAmount: taxAmount,     // Include taxAmount
//         };

//         res.status(200).json(responseData);

//     } catch (error) {
//         console.error('Error fetching order details:', error);
//         res.status(500).json({ message: 'Failed to retrieve order details.', error: error.message });
//     }
// });

app.get('/api/orders/:orderId', async (req, res) => {
    const orderId = req.params.orderId;

    try {
        // Fetch main order details and join with user details
        const orderQuery = `
            SELECT
                o.OrderID, o.UserID, o.OrderNumber, o.OrderDate, o.ShippingAddrID, o.BillingAddrID,
                o.TotalAmount, o.OrderStatus, o.PaymentStatus, o.CreatedAt AS OrderCreatedAt, o.UpdatedAt AS OrderUpdatedAt,
                u.Name AS UserName, u.Surname AS UserSurname, u.Email AS UserEmail, u.PhoneNumber AS UserPhone
            FROM gcinumus_PongolaSupplies_db.order o
            JOIN gcinumus_PongolaSupplies_db.user_tb u ON o.UserID = u.UserId
            WHERE o.OrderID = ?;
        `;
        const orderRows = await queryAsync(orderQuery, [orderId]);

        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        const order = orderRows[0];

        // Fetch order items for this order, joining with product_image
        const itemsQuery = `
            SELECT
                oi.ItemId, oi.ProductID, oi.ProductName, oi.ProductDescription, oi.PricePerItem, oi.Quantity, oi.SubTotal, oi.ItemStatus, oi.ShippingTrackerNumber,
                pi.Image_url
            FROM gcinumus_PongolaSupplies_db.order_items oi
            LEFT JOIN gcinumus_PongolaSupplies_db.product_image pi ON oi.ProductID = pi.ProductID
            WHERE oi.OrderID = ?
            ORDER BY pi.SortOrder ASC, pi.ImageId ASC; -- Order by SortOrder to get a consistent main image
        `;
        const items = await queryAsync(itemsQuery, [orderId]);

        // Fetch shipping address details
        let shippingAddress = null;
        if (order.ShippingAddrID) {
            const addressQuery = `
                SELECT AddressId, Address1, Address2, CityOrSuburb, Province, ZipCode, Country, Label, AddressType, CreatedAt
                FROM gcinumus_PongolaSupplies_db.address
                WHERE AddressId = ?;
            `;
            const addressRows = await queryAsync(addressQuery, [order.ShippingAddrID]);
            if (addressRows.length > 0) {
                shippingAddress = addressRows[0];
            }
        }

        // --- Calculate Delivery Fee and Tax Amount ---
        const calculatedItemsSubTotal = items.reduce((sum, item) => sum + item.SubTotal, 0);
        let deliveryFee = 0;
        let taxAmount = 0;

        if (order.TotalAmount > calculatedItemsSubTotal) {
            deliveryFee = 2.00; // Example fixed delivery fee
            taxAmount = order.TotalAmount - calculatedItemsSubTotal - deliveryFee;
            if (taxAmount < 0) taxAmount = 0;
        }


        const responseData = {
            OrderID: order.OrderID,
            OrderNumber: order.OrderNumber,
            OrderDate: order.OrderDate,
            TotalAmount: order.TotalAmount,
            OrderStatus: order.OrderStatus,
            PaymentStatus: order.PaymentStatus,
            CreatedAt: order.OrderCreatedAt,
            UpdatedAt: order.OrderUpdatedAt,
            deliveryInfo: {
                firstName: order.UserName,
                lastName: order.UserSurname,
                email: order.UserEmail,
                phone: order.UserPhone,
                selectedAddressId: shippingAddress?.AddressId,
                streetAddress: shippingAddress?.Address1 || '',
                Address2: shippingAddress?.Address2 || '',
                postalAddress: shippingAddress?.CityOrSuburb || '',
                state: shippingAddress?.Province || '',
                zipcode: shippingAddress?.ZipCode || '',
                country: shippingAddress?.Country || '',
                addressLabel: shippingAddress?.Label || '',
                addressType: shippingAddress?.AddressType || '',
            },
            items: items, // Now includes Image_url
            deliveryFee: deliveryFee,
            taxAmount: taxAmount,
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Failed to retrieve order details.', error: error.message });
    }
});


// READ All Orders for a Specific User (GET /api/orders/user/:userId)
app.get('/api/orders/user/:userId', async (req, res) => {
    const userId = req.params.userId;
    const query = `SELECT * FROM gcinumus_PongolaSupplies_db.order WHERE UserID = ?`;
    try {
        const orders = await queryAsync(query, [userId]);
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders for user:', error);
        res.status(500).json({ message: 'Error fetching user orders', error: error.message });
    }
});

// UPDATE an Order (PUT /api/orders/:orderId)
// Allows partial updates based on fields provided in req.body
app.put('/api/orders/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const updates = req.body;

    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
        'UserID', 'ShippingAddrID', 'BillingAddrID', 'TotalAmount',
        'OrderStatus', 'PaymentStatus'
        // OrderNumber, OrderDate, CreatedAt, UpdatedAt should generally not be updated this way
    ];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && allowedFields.includes(key)) {
            updateFields.push(`${key} = ?`);
            updateValues.push(updates[key]);
        }
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for order update.' });
    }

    const query = `
        UPDATE gcinumus_PongolaSupplies_db.order
        SET 
            ${updateFields.join(', ')},
            UpdatedAt = NOW()
        WHERE OrderID = ?
    `;
    updateValues.push(orderId); // Add orderId for the WHERE clause

    try {
        const result = await queryAsync(query, updateValues);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found or no changes made.' });
        }
        res.status(200).json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Error updating order', error: error.message });
    }
});

// DELETE an Order (DELETE /api/orders/:orderId)
// IMPORTANT: Consider transaction for deleting associated order_items
app.delete('/api/orders/:orderId', async (req, res) => {
    const orderId = req.params.orderId;

    // In a real application, you'd likely want to delete associated order_items
    // within a transaction to maintain data integrity.
    // Example (conceptual):
    // await connection.beginTransaction();
    // await queryAsync('DELETE FROM order_items WHERE OrderID = ?', [orderId]);
    // await queryAsync('DELETE FROM `order` WHERE OrderID = ?', [orderId]);
    // await connection.commit();

    const query = `DELETE FROM gcinumus_PongolaSupplies_db.order WHERE OrderID = ?`;
    try {
        const result = await queryAsync(query, [orderId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Error deleting order', error: error.message });
    }
});


// --- CRUD Endpoints for `order_items` table ---

// CREATE an Order Item (POST /api/order-items)
// Typically, order items are inserted in bulk when an order is created.
// This endpoint is for single item creation if needed.
app.post('/api/order-items', async (req, res) => {
    const { OrderID, ProductID, ProductName, ProductDescription, PricePerItem, Quantity, SubTotal, ItemStatus, ShippingTrackerNumber } = req.body;

    if (!OrderID || !ProductID || !ProductName || !PricePerItem || !Quantity || !SubTotal) {
        return res.status(400).json({ message: 'Missing required fields for order item creation.' });
    }

    const query = `
        INSERT INTO gcinumus_PongolaSupplies_db.order_items
        (OrderID, ProductID, ProductName, ProductDescription, PricePerItem, Quantity, SubTotal, ItemStatus, ShippingTrackerNumber, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const values = [OrderID, ProductID, ProductName, ProductDescription, PricePerItem, Quantity, SubTotal, ItemStatus, ShippingTrackerNumber];

    try {
        const result = await queryAsync(query, values);
        res.status(201).json({ message: 'Order item created successfully', itemId: result.insertId });
    } catch (error) {
        console.error('Error creating order item:', error);
        res.status(500).json({ message: 'Error creating order item', error: error.message });
    }
});

// READ All Order Items (GET /api/order-items)
app.get('/api/order-items', async (req, res) => {
    const query = `SELECT * FROM gcinumus_PongolaSupplies_db.order_items`;
    try {
        const items = await queryAsync(query);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching all order items:', error);
        res.status(500).json({ message: 'Error fetching order items', error: error.message });
    }
});

// READ a Specific Order Item by ItemId (GET /api/order-items/:itemId)
app.get('/api/order-items/:itemId', async (req, res) => {
    const itemId = req.params.itemId;
    const query = `SELECT * FROM gcinumus_PongolaSupplies_db.order_items WHERE ItemId = ?`;
    try {
        const item = await queryAsync(query, [itemId]);
        if (item.length === 0) {
            return res.status(404).json({ message: 'Order item not found.' });
        }
        res.status(200).json(item[0]);
    } catch (error) {
        console.error('Error fetching order item:', error);
        res.status(500).json({ message: 'Error fetching order item', error: error.message });
    }
});

// READ All Items for a Specific Order (GET /api/order-items/order/:orderId)
// This is useful for displaying all products within a specific order.
app.get('/api/order-items/order/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const query = `SELECT * FROM gcinumus_PongolaSupplies_db.order_items WHERE OrderID = ?`;
    try {
        const items = await queryAsync(query, [orderId]);
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching order items for order:', error);
        res.status(500).json({ message: 'Error fetching order items', error: error.message });
    }
});

// UPDATE an Order Item (PUT /api/order-items/:itemId)
// Allows partial updates based on fields provided in req.body
app.put('/api/order-items/:itemId', async (req, res) => {
    const itemId = req.params.itemId;
    const updates = req.body;

    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
        'ProductID', 'OrderID', 'ProductName', 'ProductDescription',
        'PricePerItem', 'Quantity', 'SubTotal', 'ItemStatus', 'ShippingTrackerNumber'
    ];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && allowedFields.includes(key)) {
            updateFields.push(`${key} = ?`);
            updateValues.push(updates[key]);
        }
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for order item update.' });
    }

    const query = `
        UPDATE gcinumus_PongolaSupplies_db.order_items
        SET 
            ${updateFields.join(', ')},
            UpdatedAt = NOW()
        WHERE ItemId = ?
    `;
    updateValues.push(itemId); // Add itemId for the WHERE clause

    try {
        const result = await queryAsync(query, updateValues);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order item not found or no changes made.' });
        }
        res.status(200).json({ message: 'Order item updated successfully' });
    } catch (error) {
        console.error('Error updating order item:', error);
        res.status(500).json({ message: 'Error updating order item', error: error.message });
    }
});

// DELETE an Order Item (DELETE /api/order-items/:itemId)
app.delete('/api/order-items/:itemId', async (req, res) => {
    const itemId = req.params.itemId;
    const query = `DELETE FROM gcinumus_PongolaSupplies_db.order_items WHERE ItemId = ?`;
    try {
        const result = await queryAsync(query, [itemId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order item not found.' });
        }
        res.status(200).json({ message: 'Order item deleted successfully' });
    } catch (error) {
        console.error('Error deleting order item:', error);
        res.status(500).json({ message: 'Error deleting order item', error: error.message });
    }
});
//

app.get('/api/addresses', (req, res) => {
    const query = `
        SELECT address.AddressId,
               address.UserID,
               address.AddressType,
               address.Label,
               address.MeantFor,
               address.Address1,
               address.Address2,
               address.Country,
               address.Province,
               address.ZipCode,
               address.CreatedAt
        FROM gcinumus_PongolaSupplies_db.address;
    `;
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching all addresses:', error);
            return res.status(500).json({ message: 'Failed to fetch addresses', error: error.message });
        }
        res.status(200).json(results);
    });
});

// --- GET address by ID ---
// Fetches a single address by its AddressId.
app.get('/api/addresses/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT address.AddressId,
               address.UserID,
               address.AddressType,
               address.Label,
               address.MeantFor,
               address.Address1,
               address.Address2,
               address.Country,
               address.Province,
               address.ZipCode,
               address.CreatedAt
        FROM gcinumus_PongolaSupplies_db.address
        WHERE AddressId = ?;
    `;
    db.query(query, [id], (error, results) => {
        if (error) {
            console.error(`Error fetching address with ID ${req.params.id}:`, error);
            return res.status(500).json({ message: 'Failed to fetch address', error: error.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: `Address with ID ${id} not found.` });
        }
        res.status(200).json(results[0]);
    });
});

// --- POST (Create) a new address ---
// Adds a new address to the 'address' table.
app.post('/api/addresses', (req, res) => {
    // Destructure required fields from request body
    const { UserID, AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode } = req.body;

    // Basic validation
    if (!UserID || !AddressType || !Label || !MeantFor || !Address1 || !Country || !Province || !ZipCode) {
        return res.status(400).json({ message: 'Missing required address fields.' });
    }

    const query = `
        INSERT INTO gcinumus_PongolaSupplies_db.address
        (UserID, AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
    `;
    db.query(query, [
        UserID, AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode
    ], (error, result) => {
        if (error) {
            console.error('Error creating address:', error);
            return res.status(500).json({ message: 'Failed to create address', error: error.message });
        }
        res.status(201).json({
            message: 'Address created successfully',
            addressId: result.insertId,
            data: req.body
        });
    });
});

// --- PUT (Update) an existing address ---
// Updates an address by its AddressId.
app.put('/api/addresses/:id', (req, res) => {
    const { id } = req.params;
    const { UserID, AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode } = req.body;

    // At least one field should be provided for update
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'No update fields provided.' });
    }

    // Build dynamic SET clause for the UPDATE query
    const updates = [];
    const values = [];
    if (UserID !== undefined) { updates.push('UserID = ?'); values.push(UserID); }
    if (AddressType !== undefined) { updates.push('AddressType = ?'); values.push(AddressType); }
    if (Label !== undefined) { updates.push('Label = ?'); values.push(Label); }
    if (MeantFor !== undefined) { updates.push('MeantFor = ?'); values.push(MeantFor); }
    if (Address1 !== undefined) { updates.push('Address1 = ?'); values.push(Address1); }
    if (Address2 !== undefined) { updates.push('Address2 = ?'); values.push(Address2); }
    if (Country !== undefined) { updates.push('Country = ?'); values.push(Country); }
    if (Province !== undefined) { updates.push('Province = ?'); values.push(Province); }
    if (ZipCode !== undefined) { updates.push('ZipCode = ?'); values.push(ZipCode); }

    if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update.' });
    }

    const query = `
        UPDATE gcinumus_PongolaSupplies_db.address
        SET ${updates.join(', ')}
        WHERE AddressId = ?;
    `;
    db.query(query, [...values, id], (error, result) => {
        if (error) {
            console.error(`Error updating address with ID ${req.params.id}:`, error);
            return res.status(500).json({ message: 'Failed to update address', error: error.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Address with ID ${id} not found or no changes made.` });
        }
        res.status(200).json({ message: `Address with ID ${id} updated successfully.`, affectedRows: result.affectedRows });
    });
});

// --- DELETE an address ---
// Deletes an address by its AddressId.
app.delete('/api/addresses/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        DELETE FROM gcinumus_PongolaSupplies_db.address
        WHERE AddressId = ?;
    `;
    db.query(query, [id], (error, result) => {
        if (error) {
            console.error(`Error deleting address with ID ${req.params.id}:`, error);
            return res.status(500).json({ message: 'Failed to delete address', error: error.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Address with ID ${id} not found.` });
        }
        res.status(200).json({ message: `Address with ID ${id} deleted successfully.`, affectedRows: result.affectedRows });
    });
});

app.get('/api/categories', (req, res) => {
    const sqlQuery = 'SELECT CategoryId, Name, Description, Image, ParentCategoryId, CreatedAt, UpdatedAt FROM category';
    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ message: 'An error occurred while fetching categories.' });
        }
        res.json(results);
    });
});


// GET category by ID
app.get('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const sqlQuery = 'SELECT CategoryId, Name, Description, Image, ParentCategoryId, CreatedAt, UpdatedAt FROM category WHERE CategoryId = ?';
    db.query(sqlQuery, [id], (err, results) => {
        if (err) {
            console.error(`Error fetching category with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while fetching category.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(results[0]);
    });
});

// POST (Create) a new category
app.post('/api/categories', (req, res) => {
    const { Name, Description, Image, ParentCategoryId } = req.body;
    // Basic validation
    if (!Name) {
        return res.status(400).json({ message: 'Category Name is required' });
    }
    const sqlQuery = 'INSERT INTO category (Name, Description, Image, ParentCategoryId) VALUES (?, ?, ?, ?)';
    db.query(sqlQuery, [Name, Description, Image, ParentCategoryId], (err, result) => {
        if (err) {
            console.error('Error creating category:', err);
            return res.status(500).json({ message: 'An error occurred while creating the category.' });
        }
        res.status(201).json({
            message: 'Category created successfully',
            category: {
                CategoryId: result.insertId,
                Name,
                Description,
                Image: Image || 'none',
                ParentCategoryId: result.insertId,
                // CreatedAt: new Date().toISOString(), // Simulate creation time
                // UpdatedAt: new Date().toISOString()  // Simulate update time
            }
        });
    });
});


// PUT (Update) an existing category
app.put('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const { Name, Description, Image, ParentCategoryId } = req.body;
    // Allow partial updates, but ensure at least one field is provided
    if (!Name && !Description && !Image) {
        return res.status(400).json({ message: 'No fields provided for update' });
    }

    let updateFields = [];
    let queryParams = [];

    if (Name !== undefined) { updateFields.push('Name = ?'); queryParams.push(Name); }
    if (Description !== undefined) { updateFields.push('Description = ?'); queryParams.push(Description); }
    if (Image !== undefined) { updateFields.push('Image = ?'); queryParams.push(Image); }
    // Handle ParentCategoryId specifically for null
    if (ParentCategoryId !== undefined) {
        updateFields.push('ParentCategoryId = ?');
        queryParams.push(ParentCategoryId);
    }
    updateFields.push('UpdatedAt = NOW()'); // Update timestamp

    queryParams.push(id); // Add ID for WHERE clause

    const sqlQuery = `UPDATE category SET ${updateFields.join(', ')} WHERE CategoryId = ?`;

    db.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
            console.error(`Error updating category with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while updating the category.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Category not found or no changes made' });
        }
        // Fetch the updated record to return it
        db.query('SELECT CategoryId, Name, Description, Image, ParentCategoryId, CreatedAt, UpdatedAt FROM category WHERE CategoryId = ?', [id], (err, updatedRows) => {
            if (err) {
                console.error(`Error fetching updated category with ID ${id}:`, err);
                return res.status(500).json({ message: 'An error occurred while fetching the updated category.' });
            }
            res.json({
                message: 'Category updated successfully',
                category: updatedRows[0]
            });
        });
    });
});


// DELETE a category
app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    const sqlQuery = 'DELETE FROM category WHERE CategoryId = ?';
    db.query(sqlQuery, [id], (err, result) => {
        if (err) {
            console.error(`Error deleting category with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while deleting the category.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json({ message: 'Category deleted successfully' });
    });
});

// --- PRODUCT TYPE Endpoints ---

// GET all product types
app.get('/api/types', (req, res) => {
    const sqlQuery = 'SELECT TypeId, CategoryID, TypeName, CreatedAt, UpdatedAt FROM product_type';
    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error fetching product types:', err);
            return res.status(500).json({ message: 'An error occurred while fetching product types.' });
        }
        res.json(results);
    });
});

// GET product type by ID
app.get('/api/types/:id', (req, res) => {
    const { id } = req.params;
    const sqlQuery = 'SELECT TypeId, CategoryID, TypeName, CreatedAt, UpdatedAt FROM product_type WHERE TypeId = ?';
    db.query(sqlQuery, [id], (err, results) => {
        if (err) {
            console.error(`Error fetching product type with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while fetching the product type.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Product type not found' });
        }
        res.json(results[0]);
    });
});

// POST (Create) a new product type
app.post('/api/types', (req, res) => {
    const { CategoryID, TypeName } = req.body;
    if (!CategoryID || !TypeName) {
        return res.status(400).json({ message: 'CategoryID and TypeName are required' });
    }
    const sqlQuery = 'INSERT INTO product_type (CategoryID, TypeName) VALUES (?, ?)';
    db.query(sqlQuery, [CategoryID, TypeName], (err, result) => {
        if (err) {
            console.error('Error creating product type:', err);
            return res.status(500).json({ message: 'An error occurred while creating the product type.' });
        }
        res.status(201).json({
            message: 'Product type created successfully',
            type: {
                TypeId: result.insertId,
                CategoryID,
                TypeName,
                CreatedAt: new Date().toISOString(),
                UpdatedAt: new Date().toISOString()
            }
        });
    });
});

// PUT (Update) an existing product type
app.put('/api/types/:id', (req, res) => {
    const { id } = req.params;
    const { CategoryID, TypeName } = req.body;

    let updateFields = [];
    let queryParams = [];

    if (CategoryID !== undefined) { updateFields.push('CategoryID = ?'); queryParams.push(CategoryID); }
    if (TypeName !== undefined) { updateFields.push('TypeName = ?'); queryParams.push(TypeName); }
    updateFields.push('UpdatedAt = NOW()');

    if (updateFields.length === 1 && updateFields[0].includes('UpdatedAt')) { // Only UpdatedAt is present
        return res.status(400).json({ message: 'No fields provided for update' });
    }

    queryParams.push(id);

    const sqlQuery = `UPDATE product_type SET ${updateFields.join(', ')} WHERE TypeId = ?`;

    db.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
            console.error(`Error updating product type with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while updating the product type.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product type not found or no changes made' });
        }
        db.query('SELECT TypeId, CategoryID, TypeName, CreatedAt, UpdatedAt FROM product_type WHERE TypeId = ?', [id], (err, updatedRows) => {
            if (err) {
                console.error(`Error fetching updated product type with ID ${id}:`, err);
                return res.status(500).json({ message: 'An error occurred while fetching the updated product type.' });
            }
            res.json({
                message: 'Product type updated successfully',
                type: updatedRows[0]
            });
        });
    });
});
// DELETE a product type
app.delete('/api/types/:id', (req, res) => {
    const { id } = req.params;
    const sqlQuery = 'DELETE FROM product_type WHERE TypeId = ?';
    db.query(sqlQuery, [id], (err, result) => {
        if (err) {
            console.error(`Error deleting product type with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while deleting the product type.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product type not found' });
        }
        res.status(200).json({ message: 'Product type deleted successfully' });
    });
});


// --- PRODUCT BRAND Endpoints ---

// GET all product brands
app.get('/api/brands', (req, res) => {
    const sqlQuery = 'SELECT BrandId, BrandName, CreatedAt, UpdatedAt FROM product_brand';
    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error fetching product brands:', err);
            return res.status(500).json({ message: 'An error occurred while fetching product brands.' });
        }
        res.json(results);
    });
});


// GET product brand by ID
app.get('/api/brands/:id', (req, res) => {
    const { id } = req.params;
    const sqlQuery = 'SELECT BrandId, BrandName, CreatedAt, UpdatedAt FROM product_brand WHERE BrandId = ?';
    db.query(sqlQuery, [id], (err, results) => {
        if (err) {
            console.error(`Error fetching product brand with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while fetching the product brand.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Product brand not found' });
        }
        res.json(results[0]);
    });
});

// POST (Create) a new product brand
app.post('/api/brands', (req, res) => {
    const { BrandName } = req.body;
    if (!BrandName) {
        return res.status(400).json({ message: 'BrandName is required' });
    }
    const sqlQuery = 'INSERT INTO product_brand (BrandName) VALUES (?)';
    db.query(sqlQuery, [BrandName], (err, result) => {
        if (err) {
            console.error('Error creating product brand:', err);
            return res.status(500).json({ message: 'An error occurred while creating the product brand.' });
        }
        res.status(201).json({
            message: 'Product brand created successfully',
            brand: {
                BrandId: result.insertId,
                BrandName,
                CreatedAt: new Date().toISOString(),
                UpdatedAt: new Date().toISOString()
            }
        });
    });
});


// PUT (Update) an existing product brand
app.put('/api/brands/:id', (req, res) => {
    const { id } = req.params;
    const { BrandName } = req.body;

    if (!BrandName) {
        return res.status(400).json({ message: 'BrandName is required for update' });
    }

    const sqlQuery = 'UPDATE product_brand SET BrandName = ?, UpdatedAt = NOW() WHERE BrandId = ?';
    db.query(sqlQuery, [BrandName, id], (err, result) => {
        if (err) {
            console.error(`Error updating product brand with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while updating the product brand.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product brand not found or no changes made' });
        }
        db.query('SELECT BrandId, BrandName, CreatedAt, UpdatedAt FROM product_brand WHERE BrandId = ?', [id], (err, updatedRows) => {
            if (err) {
                console.error(`Error fetching updated product brand with ID ${id}:`, err);
                return res.status(500).json({ message: 'An error occurred while fetching the updated product brand.' });
            }
            res.json({
                message: 'Product brand updated successfully',
                brand: updatedRows[0]
            });
        });
    });
});


// DELETE a product brand
app.delete('/api/brands/:id', (req, res) => {
    const { id } = req.params;
    const sqlQuery = 'DELETE FROM product_brand WHERE BrandId = ?';
    db.query(sqlQuery, [id], (err, result) => {
        if (err) {
            console.error(`Error deleting product brand with ID ${id}:`, err);
            return res.status(500).json({ message: 'An error occurred while deleting the product brand.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product brand not found' });
        }
        res.status(200).json({ message: 'Product brand deleted successfully' });
    });
});



app.post('/api/place-order', async (req, res) => {
    const { deliveryInfo, items, paymentMethod, deliveryFee, return_Url } = req.body; // Added deliveryFeeAmount for testing

    // --- 1. Validate Input Data ---
    // Basic validation - you should expand this to validate all fields properly
    if (!deliveryInfo || !items || items.length === 0 || !paymentMethod) {
        console.error('Validation Error: Missing required order information.');
        return res.status(400).json({ message: 'Missing required order information.' });
    }

    // Validate deliveryInfo fields (basic check)
    if (!deliveryInfo.firstName || !deliveryInfo.lastName || !deliveryInfo.email || !deliveryInfo.streetAddress || !deliveryInfo.phone) {
        console.error('Validation Error: Missing required delivery information fields.');
        return res.status(400).json({ message: 'Missing required delivery information fields.' });
    }

    // Validate items structure (basic check)
    for (const item of items) {
        if (!item.productId || item.quantity <= 0) {
            console.error('Validation Error: Invalid item data in cart.');
            return res.status(400).json({ message: 'Invalid item data in cart.' });
        }
    }

    // --- 2. Fetch Product Details (Price, Name, Description) Securely from Database ---
    const productIds = items.map(item => item.productId);
    // Modified query to fetch ProductName and ProductDescription as per order_items table structure
    const getProductsQuery = `SELECT \`ProductId\`, \`ProductName\`, \`ProductDescription\`, \`Price\` FROM \`gcinumus_PongolaSupplies_db\`.\`product\` WHERE \`ProductId\` IN (?)`;

    let products;
    try {
        // Execute the query to get product details
        products = await new Promise((resolve, reject) => {
            db.query(getProductsQuery, [productIds], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (products.length !== productIds.length) {
            // This means some product IDs from the cart were not found in the database
            console.error('Error: Some product IDs from cart not found in database.');
            return res.status(400).json({ message: 'Some items in your cart are no longer available.' });
        }

    } catch (error) {
        console.error('Error fetching product details for order:', error);
        return res.status(500).json({ message: 'An error occurred while validating product details.' });
    }

    // Map fetched products by ID for easy lookup
    const productDetailsMap = products.reduce((map, product) => {
        map[product.ProductId] = product; // Store the whole product object
        return map;
    }, {});

    // --- 3. Calculate Total Securely and Prepare Order Items Data ---
    let subtotal = 0;
    const orderItemsDetails = []; // To store details for order_items table

    for (const item of items) {
        const product = productDetailsMap[item.productId]; // Get product details from securely fetched data
        if (!product) {
            // Should not happen if the productIds check passed, but as a safeguard
            console.error(`Error: Details not found for product ID ${item.productId} during total calculation.`);
            return res.status(500).json({ message: 'An internal error occurred while calculating order total.' });
        }

        const pricePerItem = product.Price || 0; // Use fetched price, default to 0 if not available
        const itemSubtotal = pricePerItem * item.quantity;
        subtotal += itemSubtotal;

        // Prepare data for order_items table, matching its structure
        orderItemsDetails.push({
            ProductID: item.productId,
            ProductName: product.ProductName,
            ProductDescription: product.ProductDescription,
            PricePerItem: pricePerItem,
            Quantity: item.quantity,
            SubTotal: itemSubtotal, // Include item subtotal
            ItemStatus: 'Pending', // Initial item status
            ShippingTrackerNumber: null, // Initial tracker number
        });
    }

    // Use the deliveryFeeAmount passed from the frontend for testing, but ideally calculate this on backend
    const ddeliveryFee = deliveryFee !== undefined ? parseFloat(deliveryFee) : (subtotal > 0 ? deliveryFee : 0); // Use frontend value if provided, otherwise use backend logic
    const grandTotal = subtotal + ddeliveryFee;


    // --- 4. Save the Order to the Database ---
    // Modified INSERT query to match the 'order' table structure
    const orderInsertQuery = `
        INSERT INTO \`gcinumus_PongolaSupplies_db\`.\`order\`
        (\`UserID\`, \`OrderNumber\`, \`ShippingAddrID\`, \`BillingAddrID\`, \`TotalAmount\`, \`OrderStatus\`, \`PaymentStatus\`)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    // Assuming you have a way to get the UserID (e.g., from authenticated user session)
    // For now, using a placeholder UserID = 1. You need to replace this.
    const userId = deliveryInfo.userID; // ** IMPORTANT: Replace with actual User ID from user session **

    // Generate a unique Order Number (example: using timestamp or a library like uuid)
    const orderNumber = `ORD-${Date.now()}`; // Example simple order number

    // ** IMPORTANT: Handle ShippingAddrID and BillingAddrID **
    // Your table structure implies separate address records. The frontend sends address strings.
    // You need to decide how to handle this:
    // Option 1 (Recommended): Save the delivery address to an address table first and get its ID.
    // Option 2 (Simpler for testing, if acceptable): Store the address string directly in the order table if you modify its structure.
    // For this update, I will use placeholder IDs (e.g., 1) and add comments.
    const shippingAddrId = deliveryInfo.selectedAddressId; // ** IMPORTANT: Replace with actual Shipping Address ID **
    const billingAddrId = null; // ** IMPORTANT: Replace with actual Billing Address ID (could be same as shipping) **


    let orderId;
    try {
        // Insert into orders table
        const orderResult = await new Promise((resolve, reject) => {
            db.query(orderInsertQuery, [userId, orderNumber, shippingAddrId, billingAddrId, grandTotal, 'Pending', 'Pending'], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
        orderId = orderResult.insertId; // Get the ID of the newly inserted order

        // Insert into order_items table
        // Modified INSERT query to match the 'order_items' table structure
        const orderItemsInsertQuery = `
            INSERT INTO \`gcinumus_PongolaSupplies_db\`.\`order_items\`
            (\`OrderID\`, \`ProductID\`, \`ProductName\`, \`ProductDescription\`, \`PricePerItem\`, \`Quantity\`, \`SubTotal\`, \`ItemStatus\`, \`ShippingTrackerNumber\`)
            VALUES ?
        `;
        // Prepare values for bulk insert, matching order_items columns
        const orderItemsValues = orderItemsDetails.map(item => [
            orderId,
            item.ProductID,
            item.ProductName,
            item.ProductDescription,
            item.PricePerItem,
            item.Quantity,
            item.SubTotal,
            item.ItemStatus,
            item.ShippingTrackerNumber

        ]);

        if (orderItemsValues.length > 0) {
            await new Promise((resolve, reject) => {
                db.query(orderItemsInsertQuery, [orderItemsValues], (err, result) => {
                    if (err) {
                        console.error('Error inserting order items:', err);
                        // Consider rolling back the orders insert if order_items insert fails
                        // db.query('DELETE FROM `gcinumus_PongolaSupplies_db`.`order` WHERE `OrderId` = ?', [orderId], (rollbackErr) => { ... });
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        }

    } catch (error) {
        console.error('Error saving order to database:', error);
        // Consider rolling back the orders insert if order_items insert fails
        return res.status(500).json({ message: 'An error occurred while saving your order.' });
    }


    // --- 5. Handle Payment Method ---
    if (paymentMethod === 'cod') {
        // For Cash on Delivery, order is placed, no external payment needed
        // Respond with success and the new order ID
        res.json({ success: true, message: 'Order placed successfully (Cash on Delivery)!', orderId: orderId });

    } else if (paymentMethod === 'payfast') {
        // --- Generate PayFast Form Data ---
        // This is a simplified example. Refer to PayFast documentation for all required fields.
        const payfastFormData = {
            merchant_id: PAYFAST_MERCHANT_ID,
            merchant_key: PAYFAST_MERCHANT_KEY,
            return_url: `${return_Url}?orderID=${orderId}`,
            cancel_url: CANCEL_URL,
            notify_url: NOTIFY_URL,
            name_first: deliveryInfo.firstName,
            name_last: deliveryInfo.lastName,
            email_address: deliveryInfo.email,
            cell_number: deliveryInfo.phone, // Assuming phone maps to cell_number
            // m_indy: orderId, // Use orderId as a custom parameter to identify the order on return/notify
            custom_int1: orderId,
            amount: grandTotal.toFixed(2), // Total amount with 2 decimal places
            item_name: `Order #${orderNumber}`, // Use the generated order number
            item_description: `Purchase from Pongola Store (Order #${orderNumber})`, // Use the generated order number
            // Add other required or optional fields as per PayFast documentation
            // e.g., custom_str1, custom_int1, email_confirmation, confirmation_address, etc.
        };



        // --- Calculate PayFast Signature ---
        // The signature is calculated based on specific fields, ordered alphabetically, and using the passphrase.
        // ** IMPORTANT: Refer to PayFast documentation for the exact signature calculation method and fields **
        // This is a common method, but verify with PayFast's latest documentation.
        // The string to sign should include the passphrase at the end.
        // Fields to include in the signature string (alphabetical order):

        console.log('PayFast Payload:', payfastFormData);
        // Respond to the frontend with the PayFast URL and form data
        res.json({ success: true, payfastUrl: PAYFAST_URL, payfastFormData: payfastFormData });

    } else {
        // Handle unsupported payment methods
        console.error('Unsupported payment method:', paymentMethod);
        return res.status(400).json({ message: 'Unsupported payment method selected.' });
    }
});




app.post('/api/payfast-itn', (req, res) => {
    // This is a placeholder. You need to implement the full ITN validation logic here.
    // 1. Validate the ITN data received from PayFast (check merchant ID, amount, etc.).
    // 2. Validate the signature sent by PayFast.
    // 3. Check if the transaction is valid and successful.
    // 4. Update your order status in the database based on the ITN data (e.g., change status from 'Pending' to 'Processing' or 'Completed').
    // 5. Respond with 'OK' to PayFast to acknowledge receipt of the ITN.

    console.log('Received PayFast ITN:', req.body);

    // ** Implement ITN validation and order status update here **

    // Example placeholder response (you need to replace this with actual validation logic)
    if (req.body && req.body.payment_status === 'COMPLETE') {
        // Assuming basic check for completion status
        console.log('PayFast ITN: Payment Complete. Update order status.');
        // ** Your database update logic here **
        res.status(200).send('OK'); // Respond with OK to PayFast
    } else {
        console.log('PayFast ITN: Payment not complete or invalid.');
        // Handle other statuses or invalid ITNs
        res.status(400).send('Invalid ITN'); // Respond with an error status
    }

});



app.get('/api/products/:productId/images', (req, res) => {
    const productId = req.params.productId;

    const sqlQuery = `
        SELECT
            ImageId,
            ProductID,
            Image_url AS ImageUrl,
            SortOrder,
            UploadedAt
        FROM gcinumus_PongolaSupplies_db.product_image
        WHERE ProductID = ?
        ORDER BY SortOrder ASC, ImageId ASC;
    `;

    db.query(sqlQuery, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching images for product:', err);
            return res.status(500).json({ message: 'An error occurred while fetching images.' });
        }

        res.json(results);
    });
});


// app.get('/api/products-with-images/:productId', (req, res) => {
//     const productId = req.params.productId;

//     // SQL query to fetch a single product and its associated image URLs and SortOrder
//     // This uses a LEFT JOIN to get the product and its images.
//     // It orders images by SortOrder (0 first) then ImageId.
//     // We select individual image details here, not a concatenated string,
//     // because the frontend Product page needs details for each image (ID, URL, SortOrder).
//     const sqlQuery = `
//       SELECT
//           p.\`ProductId\`,
//           p.\`CategoryID\`,
//           p.\`ProductName\`,
//           p.\`ProductDescription\`,
//           p.\`Price\`,
//           p.\`Brand\`,
//           p.\`Dimensions\`,
//           p.\`Weight\`,
//           p.\`IsAvailable\`,
//           p.\`StockQuantity\`,
//           p.\`CreatedAt\`,
//           p.\`UpdatedAt\`,
//           -- Select individual image details from product_image
//           pi.\`ImageId\`, -- Use ImageId
//           CONCAT('/uploads/', pi.\`Image_url\`) AS ImageUrl, -- Use Image_url and provide full URL
//           pi.\`SortOrder\` -- Use SortOrder
//       FROM \`gcinumus_PongolaSupplies_db\`.\`product\` p
//       LEFT JOIN \`gcinumus_PongolaSupplies_db\`.\`product_image\` pi ON p.\`ProductId\` = pi.\`ProductID\` -- Corrected join condition and table name
//       WHERE p.\`ProductId\` = ?
//       ORDER BY pi.\`SortOrder\` ASC, pi.\`ImageId\` ASC; -- Order images by SortOrder (0 first) then ID
//     `;

//     db.query(sqlQuery, [productId], (err, results) => {
//         if (err) {
//             console.error('Error fetching single product with images:', err);
//             return res.status(500).json({ message: 'An error occurred while fetching the product.' });
//         }

//         if (results.length === 0) {
//             // If no product found with this ID, return 404
//             // Note: If a product exists but has no images, results will still have one row with null image fields.
//             // We check results.length for the product itself.
//             return res.status(404).json({ message: `Product with ID ${productId} not found.` });
//         }

//         // Format the results: Combine product details and group images
//         // Since the query returns multiple rows for a product with multiple images,
//         // we need to structure the response to have one product object with an array of images.
//         const product = {
//             ProductId: results[0].ProductId,
//             CategoryID: results[0].CategoryID,
//             ProductName: results[0].ProductName,
//             ProductDescription: results[0].ProductDescription,
//             Price: results[0].Price,
//             Brand: results[0].Brand,
//             Dimensions: results[0].Dimensions,
//             Weight: results[0].Weight,
//             IsAvailable: results[0].IsAvailable,
//             StockQuantity: results[0].StockQuantity,
//             CreatedAt: results[0].CreatedAt,
//             UpdatedAt: results[0].UpdatedAt,
//             Images: [] // Array to hold image objects
//         };

//         // If the first row's ImageId is not null, it means there are images.
//         // Map all result rows (which belong to this product) into image objects.
//         if (results[0].ImageId !== null) {
//             product.Images = results.map(row => ({
//                 ImageId: row.ImageId, // Use ImageId
//                 ImageUrl: row.ImageUrl, // Use the full ImageUrl
//                 SortOrder: row.SortOrder // Use SortOrder
//                 // You could add IsCover: row.SortOrder === 0 here if you prefer
//             }));
//         }

//         res.json(product);
//     });
// });

// app.get('/api/products/:productId/images', (req, res) => {
//     const productId = req.params.productId;

//     // SQL query to fetch all images for a given product, ordered by SortOrder (0 first)
//     const sqlQuery = `
//         SELECT
//             \`ImageId\`, -- Use ImageId
//             \`ProductID\`, -- Use ProductID
//             CONCAT('/uploads/', \`Image_url\`) AS ImageUrl, -- Use Image_url and provide the full URL
//             \`SortOrder\`, -- Use SortOrder
//             \`UploadedAt\` -- Use UploadedAt
//         FROM \`gcinumus_PongolaSupplies_db\`.\`product_image\` -- Use product_image table
//         WHERE \`ProductID\` = ? -- Use ProductID column
//         ORDER BY \`SortOrder\` ASC, \`ImageId\` ASC; -- Order by SortOrder then ImageId
//     `;

//     db.query(sqlQuery, [productId], (err, results) => {
//         if (err) {
//             console.error('Error fetching images for product:', err);
//             return res.status(500).json({ message: 'An error occurred while fetching images.' });
//         }
//         // Return the array of image objects
//         res.json(results);
//     });
// });


// --- API Endpoint to Upload Images for a Product ---
// This endpoint will handle POST requests to /api/products/:productId/images
// It uses the 'upload' middleware configured with multer

app.get('/api/products-with-images/:productId', (req, res) => {
    const productId = req.params.productId;

    const sqlQuery = `
      SELECT
          p.ProductId,
          p.CategoryID,
          p.ProductName,
          p.ProductDescription,
          p.Price,
          p.BrandID,
          p.TypeID,
          p.Dimensions,
          p.Weight,
          p.IsAvailable,
          p.StockQuantity,
          p.CreatedAt,
          p.UpdatedAt,
          pi.ImageId,
          pi.Image_url AS ImageUrl,
          pi.SortOrder
      FROM gcinumus_PongolaSupplies_db.product p
      LEFT JOIN gcinumus_PongolaSupplies_db.product_image pi 
        ON p.ProductId = pi.ProductID
      WHERE p.ProductId = ?
      ORDER BY pi.SortOrder ASC, pi.ImageId ASC;
    `;

    db.query(sqlQuery, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching single product with images:', err);
            return res.status(500).json({ message: 'An error occurred while fetching the product.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }

        const product = {
            ProductId: results[0].ProductId,
            CategoryID: results[0].CategoryID,
            ProductName: results[0].ProductName,
            ProductDescription: results[0].ProductDescription,
            Price: results[0].Price,
            BrandID: results[0].BrandID,
            TypeID: results[0].TypeID,

            Dimensions: results[0].Dimensions,
            Weight: results[0].Weight,
            IsAvailable: results[0].IsAvailable,
            StockQuantity: results[0].StockQuantity,
            CreatedAt: results[0].CreatedAt,
            UpdatedAt: results[0].UpdatedAt,
            Images: []
        };

        if (results[0].ImageId !== null) {
            product.Images = results.map(row => ({
                ImageId: row.ImageId,
                ImageUrl: row.ImageUrl,
                SortOrder: row.SortOrder
            }));
        }

        res.json(product);
    });
});


app.post('/api/products/:productId/images', upload3.array('images', 5), (req, res) => {
    const productId = req.params.productId;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No image files uploaded.' });
    }

    const checkProductSql = 'SELECT 1 FROM `product` WHERE `ProductId` = ?;';
    db.query(checkProductSql, [productId], (err, productResults) => {
        if (err) return res.status(500).json({ message: 'Product check failed.' });
        if (productResults.length === 0)
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });

        const countImagesSql = 'SELECT COUNT(*) AS imageCount FROM `product_image` WHERE `ProductID` = ?;';
        db.query(countImagesSql, [productId], (err, countResults) => {
            if (err) return res.status(500).json({ message: 'Image count check failed.' });

            const existingImageCount = countResults[0].imageCount;
            const totalImagesAfterUpload = existingImageCount + files.length;

            if (totalImagesAfterUpload > 5) {
                return res.status(400).json({
                    message: `Max 5 images allowed. You already have ${existingImageCount}, uploaded ${files.length}.`
                });
            }

            const getMaxSortOrderSql = 'SELECT MAX(`SortOrder`) AS maxSortOrder FROM `product_image` WHERE `ProductID` = ?;';
            db.query(getMaxSortOrderSql, [productId], (err, maxSortOrderResults) => {
                if (err) return res.status(500).json({ message: 'Sort order fetch failed.' });

                const maxSortOrder = maxSortOrderResults[0].maxSortOrder || -1;
                let currentSortOrder = maxSortOrder + 1;

                const imageValues = files.map((file, index) => [
                    productId,
                    file.path, // ✅ Cloudinary URL
                    existingImageCount === 0 && index === 0 ? 0 : currentSortOrder++
                ]);

                const insertImagesSql = `
                    INSERT INTO \`product_image\` (\`ProductID\`, \`Image_url\`, \`SortOrder\`)
                    VALUES ?;
                `;

                db.query(insertImagesSql, [imageValues], (err, result) => {
                    if (err) {
                        console.error('Image insert error:', err);
                        return res.status(500).json({ message: 'Failed to save images.' });
                    }

                    res.status(201).json({
                        message: 'Images uploaded and saved to DB successfully.',
                        uploadedCount: files.length,
                        firstInsertId: result.insertId
                    });
                });
            });
        });
    });
});


// --- API Endpoint to Set an Image as Cover ---
// This endpoint will handle PUT requests to /api/images/:imageId/set-cover
app.put('/api/images/:imageId/set-cover', (req, res) => {
    const imageIdToSetCover = req.params.imageId; // This is ImageId from product_image

    // First, get the ProductID for this image from product_image
    const getProductIdSql = 'SELECT `ProductID` FROM `product_image` WHERE `ImageId` = ?;'; // Use product_image and ImageId/ProductID
    db.query(getProductIdSql, [imageIdToSetCover], (err, results) => {
        if (err) {
            console.error('Error getting ProductID for image:', err);
            return res.status(500).json({ message: 'An error occurred while finding the product for the image.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: `Image with ID ${imageIdToSetCover} not found.` });
        }

        const productId = results[0].ProductID; // Use ProductID

        // Start a transaction to ensure atomicity (either both updates succeed or neither do)
        db.beginTransaction(err => {
            if (err) {
                console.error('Error starting transaction:', err);
                return res.status(500).json({ message: 'An error occurred while starting the transaction.' });
            }

            // 1. Set SortOrder to a value > 0 for all images of this product
            // We can set them to a high number or re-sequence them.
            // For simplicity, let's just ensure they are not 0.
            const unsetCoverSql = 'UPDATE `product_image` SET `SortOrder` = `ImageId` WHERE `ProductID` = ? AND `SortOrder` = 0;'; // Use product_image, ProductID, SortOrder, ImageId
            // Note: Setting SortOrder = ImageId is one way to give them a non-zero order, adjust if you have a specific ordering logic.
            // A more robust approach might be to fetch all images and re-assign SortOrder 1, 2, 3...
            db.query(unsetCoverSql, [productId], (err, unsetResult) => {
                if (err) {
                    console.error('Error unsetting existing cover images:', err);
                    return db.rollback(() => res.status(500).json({ message: 'An error occurred while unsetting existing cover images.' }));
                }

                // 2. Set SortOrder to 0 for the specified image
                const setCoverSql = 'UPDATE `product_image` SET `SortOrder` = 0 WHERE `ImageId` = ?;'; // Use product_image and ImageId
                db.query(setCoverSql, [imageIdToSetCover], (err, setResult) => {
                    if (err) {
                        console.error('Error setting new cover image:', err);
                        return db.rollback(() => res.status(500).json({ message: 'An error occurred while setting the new cover image.' }));
                    }

                    // Check if the specified image was actually updated
                    if (setResult.affectedRows === 0) {
                        // This case should ideally not happen if the image was found initially,
                        // but good for robustness. Rollback and return 404.
                        return db.rollback(() => res.status(404).json({ message: `Image with ID ${imageIdToSetCover} not found for this product.` }));
                    }

                    // Commit the transaction
                    db.commit(err => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            return db.rollback(() => res.status(500).json({ message: 'An error occurred while committing the transaction.' }));
                        }
                        res.json({ message: `Image with ID ${imageIdToSetCover} set as cover successfully!` });
                    });
                });
            });
        });
    });
});



// --- API Endpoint to Delete an Image by ID ---
// This endpoint will handle DELETE requests to /api/images/:imageId
app.delete('---/api/images/:imageId', (req, res) => {
    const imageIdToDelete = req.params.imageId; // This is ImageId from product_image

    // First, get the image file path, SortOrder, and ProductID before deleting the record
    const getImageInfoSql = 'SELECT `Image_url`, `SortOrder`, `ProductID` FROM `product_image` WHERE `ImageId` = ?;'; // Use product_image and its columns
    db.query(getImageInfoSql, [imageIdToDelete], (err, results) => {
        if (err) {
            console.error('Error getting image info for deletion:', err);
            return res.status(500).json({ message: 'An error occurred while finding image information for deletion.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: `Image with ID ${imageIdToDelete} not found.` });
        }

        const imageInfo = results[0];
        const imageFilePath = path.join(uploadDir, imageInfo.Image_url); // Use Image_url
        const wasCover = imageInfo.SortOrder === 0; // Check if it was the cover based on SortOrder
        const productId = imageInfo.ProductID; // Use ProductID

        // Start a transaction for deleting record and potentially setting a new cover
        db.beginTransaction(err => {
            if (err) {
                console.error('Error starting transaction for deletion:', err);
                return res.status(500).json({ message: 'An error occurred while starting the deletion transaction.' });
            }

            // Delete the image record from the product_image database
            const deleteImageSql = 'DELETE FROM `product_image` WHERE `ImageId` = ?;'; // Use product_image and ImageId
            db.query(deleteImageSql, [imageIdToDelete], (err, deleteResult) => {
                if (err) {
                    console.error('Error deleting image record:', err);
                    return db.rollback(() => res.status(500).json({ message: 'An error occurred while deleting the image record.' }));
                }

                // Now, delete the actual image file from the file system
                fs.unlink(imageFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        // Log the file deletion error, but don't necessarily fail the DB transaction
                        // as the record is already gone. Handle this based on your error strategy.
                        console.error('Error deleting image file from storage:', unlinkErr);
                        // You might want to rollback here if file deletion is critical
                        // return db.rollback(() => res.status(500).json({ message: 'An error occurred while deleting the image file.' }));
                    }
                    console.log('Image file deleted from storage:', imageFilePath);

                    // If the deleted image was the cover (SortOrder = 0), find another image for this product
                    // and set it as the new cover (e.g., the one with the lowest SortOrder)
                    if (wasCover) {
                        const findNewCoverSql = 'SELECT `ImageId` FROM `product_image` WHERE `ProductID` = ? ORDER BY `SortOrder` ASC, `ImageId` ASC LIMIT 1;'; // Use product_image, ProductID, SortOrder, ImageId
                        db.query(findNewCoverSql, [productId], (err, newCoverResults) => {
                            if (err) {
                                console.error('Error finding new cover image:', err);
                                // Log error, but commit the deletion if DB record was removed
                                db.commit(commitErr => {
                                    if (commitErr) console.error('Error committing transaction after finding new cover error:', commitErr);
                                    res.json({ message: `Image with ID ${imageIdToDelete} deleted, but failed to set a new cover.` });
                                });
                                return; // Stop here
                            }

                            if (newCoverResults.length > 0) {
                                const newCoverImageId = newCoverResults[0].ImageId; // Use ImageId
                                // Set the SortOrder of the new cover to 0
                                const setNewCoverSql = 'UPDATE `product_image` SET `SortOrder` = 0 WHERE `ImageId` = ?;'; // Use product_image and ImageId
                                db.query(setNewCoverSql, [newCoverImageId], (err, setNewCoverResult) => {
                                    if (err) {
                                        console.error('Error setting new cover image after deletion:', err);
                                        // Log error, but commit the deletion
                                        db.commit(commitErr => {
                                            if (commitErr) console.error('Error committing transaction after setting new cover error:', commitErr);
                                            res.json({ message: `Image with ID ${imageIdToDelete} deleted, but failed to set a new cover.` });
                                        });
                                        return; // Stop here
                                    }
                                    console.log(`Image with ID ${newCoverImageId} set as new cover.`);
                                    db.commit(commitErr => {
                                        if (commitErr) console.error('Error committing transaction after successful new cover set:', commitErr);
                                        res.json({ message: `Image with ID ${imageIdToDelete} deleted successfully. New cover set.` });
                                    });
                                });
                            } else {
                                // No other images left for this product
                                db.commit(commitErr => {
                                    if (commitErr) console.error('Error committing transaction after no other images found:', commitErr);
                                    res.json({ message: `Image with ID ${imageIdToDelete} deleted successfully. No other images found to set as cover.` });
                                });
                            }
                        });
                    } else {
                        // If the deleted image was NOT the cover, just commit the deletion
                        db.commit(commitErr => {
                            if (commitErr) console.error('Error committing transaction after non-cover deletion:', commitErr);
                            res.json({ message: `Image with ID ${imageIdToDelete} deleted successfully.` });
                        });
                    }
                });
            });
        });
    });
});

function extractPublicId(url) {
    const parts = url.split('/');
    const filename = parts.pop().split('.')[0];
    const folder = parts.slice(parts.indexOf('upload') + 1).join('/');
    return `${folder}/${filename}`;
}

app.delete('/api/images/:imageId', (req, res) => {
    const imageIdToDelete = req.params.imageId;

    const getImageInfoSql = `
        SELECT Image_url, SortOrder, ProductID 
        FROM product_image 
        WHERE ImageId = ?;
    `;
    db.query(getImageInfoSql, [imageIdToDelete], (err, results) => {
        if (err || results.length === 0) {
            console.error('Error fetching image for deletion:', err);
            return res.status(404).json({ message: 'Image not found.' });
        }

        const imageInfo = results[0];
        const wasCover = imageInfo.SortOrder === 0;
        const productId = imageInfo.ProductID;
        const publicId = extractPublicId(imageInfo.Image_url);

        db.beginTransaction(err => {
            if (err) return res.status(500).json({ message: 'Transaction start error.' });

            // 1. Delete DB record
            const deleteImageSql = 'DELETE FROM product_image WHERE ImageId = ?;';
            db.query(deleteImageSql, [imageIdToDelete], (err, deleteResult) => {
                if (err) return db.rollback(() =>
                    res.status(500).json({ message: 'DB delete error.' }));

                // 2. Delete from Cloudinary
                cloudinary.uploader.destroy(publicId, (error, result) => {
                    if (error) console.error('Cloudinary delete failed:', error);
                    else console.log('Deleted from Cloudinary:', result);

                    // 3. Handle cover image replacement
                    if (wasCover) {
                        const findNewCoverSql = `
                            SELECT ImageId FROM product_image 
                            WHERE ProductID = ? 
                            ORDER BY SortOrder ASC, ImageId ASC LIMIT 1;
                        `;
                        db.query(findNewCoverSql, [productId], (err, newCoverResults) => {
                            if (err || newCoverResults.length === 0) {
                                return db.commit(commitErr => {
                                    if (commitErr) console.error('Commit error after cover delete:', commitErr);
                                    res.json({ message: `Image deleted. No new cover set.` });
                                });
                            }

                            const newCoverImageId = newCoverResults[0].ImageId;
                            const setNewCoverSql = 'UPDATE product_image SET SortOrder = 0 WHERE ImageId = ?;';
                            db.query(setNewCoverSql, [newCoverImageId], (err, updateResult) => {
                                db.commit(commitErr => {
                                    if (commitErr) console.error('Commit error:', commitErr);
                                    res.json({ message: `Image deleted. New cover set.` });
                                });
                            });
                        });
                    } else {
                        db.commit(commitErr => {
                            if (commitErr) console.error('Commit error:', commitErr);
                            res.json({ message: `Image deleted successfully.` });
                        });
                    }
                });
            });
        });
    });
});



app.get('---/api/products-with-images', (req, res) => { // Renamed endpoint
    // SQL query to fetch all products and their associated image URLs
    // This uses a LEFT JOIN to get all products, even if they have no images
    // GROUP_CONCAT is used to aggregate multiple image URLs into a single string per product
    // Use product_image table and its columns
    const sqlQuery = `
      SELECT
          p.\`ProductId\`,
          p.\`CategoryID\`,
          p.\`ProductName\`,
          p.\`ProductDescription\`,
          p.\`Price\`,
          p.\`BrandID\`,
          p.\`TypeID\`,
          p.\`Dimensions\`,
          p.\`Weight\`,
          p.\`IsAvailable\`,
          p.\`StockQuantity\`,
          p.\`CreatedAt\`,
          p.\`UpdatedAt\`,
          -- Concatenate image URLs, ordered by SortOrder (0 first), then by ImageId
          -- The CONCAT('/uploads/', pi.Image_url) assumes images are served from /uploads
          GROUP_CONCAT(
              CONCAT('/uploads/', pi.\`Image_url\`)
              ORDER BY pi.\`SortOrder\` ASC, pi.\`ImageId\` ASC
              SEPARATOR ','
          ) AS ImageUrls
      FROM \`gcinumus_PongolaSupplies_db\`.\`product\` p
      LEFT JOIN \`gcinumus_PongolaSupplies_db\`.\`product_image\` pi ON p.\`ProductId\` = pi.\`ProductID\` -- Corrected join condition and table name
      GROUP BY p.\`ProductId\`
      ORDER BY p.\`ProductId\`; -- Order products by ID
    `;

    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error fetching products with images:', err);
            return res.status(500).json({ message: 'An error occurred while fetching product information.' });
        }

        // Format the results: convert ImageUrls string to an array
        const formattedResults = results.map(product => ({
            ...product,
            // Split the concatenated string into an array.
            // If ImageUrls is null (no images), split('') results in [''],
            // so we check if it exists before splitting.
            ImageUrls: product.ImageUrls ? product.ImageUrls.split(',') : [],
        }));

        res.json(formattedResults);
    });
});

app.get('/api/products-with-images', (req, res) => {
    const sqlQuery = `
        SELECT
            p.ProductId,
            p.CategoryID,
            p.ProductName,
            p.ProductDescription,
            p.Price,
            p.BrandID,
            p.TypeID,
            p.Dimensions,
            p.Weight,
            p.IsAvailable,
            p.StockQuantity,
            p.CreatedAt,
            p.UpdatedAt,
            GROUP_CONCAT(
                pi.Image_url
                ORDER BY pi.SortOrder ASC, pi.ImageId ASC
                SEPARATOR ','
            ) AS ImageUrls
        FROM gcinumus_PongolaSupplies_db.product p
        LEFT JOIN gcinumus_PongolaSupplies_db.product_image pi 
        ON p.ProductId = pi.ProductID
        GROUP BY p.ProductId
        ORDER BY p.ProductId;
    `;

    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error fetching products with images:', err);
            return res.status(500).json({ message: 'Failed to fetch products.' });
        }

        const formattedResults = results.map(product => ({
            ...product,
            ImageUrls: product.ImageUrls ? product.ImageUrls.split(',') : []
        }));

        res.json(formattedResults);
    });
});






app.get('/api/products', (req, res) => {
    // SQL query to fetch all products based on the provided structure
    const sqlQuery = `
      SELECT
          \`product\`.\`ProductId\`,
          \`product\`.\`CategoryID\`,
          \`product\`.\`ProductName\`,
          \`product\`.\`ProductDescription\`,
          \`product\`.\`Price\`,
          \`product\`.\`BrandID\`,
          \`product\`.\`TypeID\`,
          \`product\`.\`Dimensions\`,
          \`product\`.\`Weight\`,
          \`product\`.\`IsAvailable\`,
          \`product\`.\`StockQuantity\`,
          \`product\`.\`CreatedAt\`,
          \`product\`.\`UpdatedAt\`
      FROM \`gcinumus_PongolaSupplies_db\`.\`product\`;
    `;

    // Execute the query using the callback pattern
    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({ message: 'An error occurred while fetching product information.' });
        }

        res.json(results);
    });
});

// --- API Endpoint to Get a Single Product by ID ---
// This endpoint will handle GET requests to /api/products/:productId
app.get('/api/products/:productId', (req, res) => {
    const productId = req.params.productId;

    // SQL query to fetch a single product by its ID
    const sqlQuery = `
      SELECT
          \`product\`.\`ProductId\`,
          \`product\`.\`CategoryID\`,
          \`product\`.\`ProductName\`,
          \`product\`.\`ProductDescription\`,
          \`product\`.\`Price\`,
          \`product\`.\`BrandID\`,
         \`product\`.\`TypeID\`,
          \`product\`.\`Dimensions\`,
          \`product\`.\`Weight\`,
          \`product\`.\`IsAvailable\`,
          \`product\`.\`StockQuantity\`,
          \`product\`.\`CreatedAt\`,
          \`product\`.\`UpdatedAt\`
      FROM \`gcinumus_PongolaSupplies_db\`.\`product\`
      WHERE \`ProductId\` = ?;
    `;

    // Execute the query with the product ID
    db.query(sqlQuery, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).json({ message: 'An error occurred while fetching the product.' });
        }

        // If no product is found with the given ID
        if (results.length === 0) {
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }

        // Send the first result (should be only one)
        res.json(results[0]);
    });
});


// --- API Endpoint to Create a New Product ---
// This endpoint will handle POST requests to /api/products
app.post('/api/products', (req, res) => {
    // Extract product data from the request body
    const {
        CategoryID,
        ProductName,
        ProductDescription,
        Price,
        BrandID,
        TypeID,
        Dimensions,
        Weight,
        IsAvailable, // Assuming boolean or tinyint in DB
        StockQuantity
    } = req.body;

    // Basic validation: Check for required fields (adjust as needed)
    if (!CategoryID || !ProductName || Price === undefined || StockQuantity === undefined) {
        return res.status(400).json({ message: 'CategoryID, ProductName, Price, and StockQuantity are required fields.' });
    }

    // SQL query to insert a new product
    const sqlQuery = `
      INSERT INTO \`product\` (
          \`CategoryID\`,
          \`ProductName\`,
          \`ProductDescription\`,
          \`Price\`,
          \`BrandID\`,
          \`TypeID\`,
          \`Dimensions\`,
          \`Weight\`,
          \`IsAvailable\`,
          \`StockQuantity\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?);
    `;

    // Values to be inserted, corresponding to the placeholders
    const values = [
        CategoryID,
        ProductName,
        ProductDescription || null, // Optional fields can be null
        Price,
        BrandID || null,
        TypeID || null,
        Dimensions || null,
        Weight || null,
        IsAvailable === undefined ? 1 : IsAvailable, // Default IsAvailable to 1 (true) if not provided
        StockQuantity
    ];

    // Execute the insert query
    db.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error creating product:', err);
            // Check for potential foreign key constraint issues (e.g., invalid CategoryID)
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ message: 'Invalid CategoryID provided.' });
            }
            return res.status(500).json({ message: 'An error occurred while creating the product.' });
        }

        res.status(201).json({ message: 'Product created successfully!', productId: result.insertId });
    });
});

// --- API Endpoint to Update an Existing Product ---
// This endpoint will handle PUT requests to /api/products/:productId
app.put('/api/products/:productId', (req, res) => {
    const productId = req.params.productId;
    const updatedProductData = req.body;

    // Basic validation: Check if any data is provided for update
    if (Object.keys(updatedProductData).length === 0) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    // Construct the SQL query dynamically based on provided fields
    let sqlQuery = 'UPDATE `product` SET ';
    const updates = [];
    const values = [];

    // Iterate over the fields in the request body to build the update query
    for (const field in updatedProductData) {
        // Ensure the field is one of the allowed columns (basic security)
        const allowedFields = [
            'CategoryID',
            'ProductName',
            'ProductDescription',
            'Price',
            'BrandID',
            'TypeID',
            'Dimensions',
            'Weight',
            'IsAvailable',
            'StockQuantity'
        ];
        if (allowedFields.includes(field)) {
            updates.push(`\`${field}\` = ?`);
            values.push(updatedProductData[field]);
        }
    }

    // If no valid fields were provided for update
    if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Join the update clauses
    sqlQuery += updates.join(', ');

    // Add the WHERE clause
    sqlQuery += ' WHERE `ProductId` = ?;';
    values.push(productId); // Add the product ID to the values array

    // Execute the update query
    db.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error updating product:', err);
            // Check for potential foreign key constraint issues (e.g., invalid CategoryID)
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ message: 'Invalid CategoryID provided.' });
            }
            return res.status(500).json({ message: 'An error occurred while updating the product.' });
        }

        // Check if any rows were affected
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }

        res.json({ message: `Product with ID ${productId} updated successfully!` });
    });
});

// --- API Endpoint to Delete a Product by ID ---
// This endpoint will handle DELETE requests to /api/products/:productId
app.delete('/api/products/:productId', (req, res) => {
    const productId = req.params.productId;

    // SQL query to delete a product by its ID
    const sqlQuery = 'DELETE FROM `product` WHERE `ProductId` = ?;';

    // Execute the delete query
    db.query(sqlQuery, [productId], (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            return res.status(500).json({ message: 'An error occurred while deleting the product.' });
        }

        // Check if any rows were affected
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }

        res.json({ message: `Product with ID ${productId} deleted successfully!` });
    });
});




app.get('/api/categoriess', (req, res) => {
    // SQL query to fetch categories as provided by the user
    const sqlQuery = `
      SELECT
          \`category\`.\`CategoryId\`,
          \`category\`.\`Name\`,
          \`category\`.\`Description\`,
          \`category\`.\`Image\`,
          \`category\`.\`ParentCategoryId\`,
          \`category\`.\`CreatedAt\`,
          \`category\`.\`UpdatedAt\`
      FROM \`gcinumus_PongolaSupplies_db\`.\`category\`;
    `;

    // Execute the query using the callback pattern
    db.query(sqlQuery, (err, results) => {
        if (err) {
            // Log the error for debugging
            console.error('Error fetching categories:', err);
            // Send an error response
            // Corrected the status setting from apply(500) to status(500)
            return res.status(500).json({ message: 'An error occurred while fetching category information.' });
        }

        // Send the fetched results as a JSON response
        res.json(results);
    });
});


app.post('/api/categoriess', (req, res) => {
    // Extract category data from the request body
    const { Name, Description, Image, ParentCategoryId } = req.body;

    // Basic validation: Check if required fields are present
    if (!Name || !Description) {
        return res.status(400).json({ message: 'Name and Description are required fields.' });
    }

    // SQL query to insert a new category
    // Use placeholders (?) to prevent SQL injection
    const sqlQuery = `
      INSERT INTO \`category\` (\`Name\`, \`Description\`, \`Image\`, \`ParentCategoryId\`)
      VALUES (?, ?, ?, ?);
    `;

    // Values to be inserted, corresponding to the placeholders
    const values = [Name, Description, Image || null, ParentCategoryId || null]; // Use null for optional fields if not provided

    // Execute the insert query
    db.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error creating category:', err);
            return res.status(500).json({ message: 'An error occurred while creating the category.' });
        }

        // Send a success response
        // result.insertId will contain the ID of the newly inserted row
        res.status(201).json({ message: 'Category created successfully!', categoryId: result.insertId });
    });
});


app.put('/api/categoriess/:categoryId', (req, res) => {
    // Get the category ID from the URL parameters
    const categoryId = req.params.categoryId;

    // Extract updated category data from the request body
    const { Name, Description, Image, ParentCategoryId } = req.body;

    // Basic validation: Check if at least one field is provided for update
    if (!Name && !Description && !Image && ParentCategoryId === undefined) {
        return res.status(400).json({ message: 'At least one field (Name, Description, Image, or ParentCategoryId) must be provided for update.' });
    }

    // Construct the SQL query dynamically based on provided fields
    let sqlQuery = 'UPDATE `category` SET ';
    const updates = [];
    const values = [];

    if (Name !== undefined) {
        updates.push('`Name` = ?');
        values.push(Name);
    }
    if (Description !== undefined) {
        updates.push('`Description` = ?');
        values.push(Description);
    }
    if (Image !== undefined) {
        updates.push('`Image` = ?');
        values.push(Image);
    }
    // Check specifically for undefined, as ParentCategoryId could be null
    if (ParentCategoryId !== undefined) {
        updates.push('`ParentCategoryId` = ?');
        values.push(ParentCategoryId || null); // Use null if ParentCategoryId is explicitly set to null
    }

    // Join the update clauses
    sqlQuery += updates.join(', ');

    // Add the WHERE clause to specify the category to update
    sqlQuery += ' WHERE `CategoryId` = ?;';
    values.push(categoryId); // Add the categoryId to the values array

    // Execute the update query
    db.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error updating category:', err);
            return res.status(500).json({ message: 'An error occurred while updating the category.' });
        }

        // Check if any rows were affected (means a category with that ID was found and updated)
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Category with ID ${categoryId} not found.` });
        }

        // Send a success response
        res.json({ message: `Category with ID ${categoryId} updated successfully!` });
    });
});



app.put('/updateUser_login_single/:UserId', (req, res) => {
    const userId = req.params.UserId;
    const {
        HomeAddressID
    } = req.body;

    const query = `
        UPDATE user_tb 
        SET 
           
            HomeAddressID=?
            
        WHERE UserId = ?`;

    const values = [
        HomeAddressID, userId
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating user:', err);
            return res.status(500).json({ message: 'Error updating user home address' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User address updated successfully' });
    });
});

app.put('/updateUser_login/:UserId', (req, res) => {
    const userId = req.params.UserId;
    const {
        Name, Surname, IdNumber,
        Gender, Email, PhoneNumber, FaceImage,
        Password, ConfirmedUser, Role, HomeAddressID
    } = req.body;

    const query = `
        UPDATE user_tb 
        SET 
           
            Name = ?, 
            Surname = ?, 
            IdNumber = ?, 
            Gender = ?, 
            Email = ?, 
            PhoneNumber = ?, 
            FaceImage = ?, 
            Password = ?, 
            ConfirmedUser = ?, 
            Role = ?,
            HomeAddressID=?
            
        WHERE UserId = ?`;

    const values = [
        Name, Surname, IdNumber,
        Gender, Email, PhoneNumber, FaceImage,
        Password, ConfirmedUser, Role, HomeAddressID, userId
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating user:', err);
            return res.status(500).json({ message: 'Error updating user' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User updated successfully' });
    });
});

app.post('/new_loginn', (req, res) => {
    const { Email, Password } = req.body;

    const userQuery = `SELECT UserId AS Id, Role, Password FROM user_tb WHERE Email= ? `;
    const adminQuery = `SELECT AdminId AS Id, Role, AdminPassword AS Password FROM admin_tb WHERE AdminEmail= ? `;

    // First, check the user_tb table
    db.query(userQuery, [Email], (err, users) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({
                message: 'An error occurred during the login process!'
            });
        }

        // Check if a user was found
        if (users.length === 0) {
            // No user found, check admin_tb table
            db.query(adminQuery, [Email], (err, admins) => {
                if (err) {
                    console.error('Login error:', err);
                    return res.status(500).json({
                        message: 'An error occurred during the login process!'
                    });
                }

                // Check if an admin was found
                if (admins.length === 0) {
                    return res.status(404).json({
                        message: 'No user or admin found with that email address.'
                    });
                }

                // Admin found, check password
                const adminPassword = admins[0].Password;

                // Compare password with hashed password
                bcrypt.compare(Password, adminPassword, (err, isValid) => {
                    if (err) {
                        console.error('Error comparing password:', err);
                        return res.status(500).json({
                            message: 'An error occurred while verifying the password.'
                        });
                    }

                    if (!isValid) {
                        return res.status(401).json({
                            message: 'Incorrect password.'
                        });
                    }

                    // Successful login for admin
                    res.json({
                        message: 'Login successful!',
                        userId: admins[0].Id,
                        Role: admins[0].Role
                    });
                });
            });
        } else {
            // User found, check password
            const userPassword = users[0].Password;

            // Ensure the password exists and is not null
            if (!userPassword || userPassword === 'null') {
                return res.status(201).json({
                    message: 'Existing user must create a new password',
                    updatePassword: true,
                    userId: users[0].Id
                });
            }

            // Compare password with hashed password
            bcrypt.compare(Password, userPassword, (err, isValid) => {
                if (err) {
                    console.error('Error comparing password:', err);
                    return res.status(500).json({
                        message: 'An error occurred while verifying the password.'
                    });
                }

                if (!isValid) {
                    return res.status(401).json({
                        message: 'Incorrect password.'
                    });
                }

                // Successful login for user
                res.json({
                    message: 'Login successful!',
                    userId: users[0].Id,
                    Role: users[0].Role
                });
            });
        }
    });
});

app.get('/new_getUser_with_email/:Email', (req, res) => {
    const { Email } = req.params;

    const qUserText = 'SELECT * FROM user_tb WHERE Email=?';
    const qAdminText = 'SELECT * FROM admin_tb WHERE AdminEmail=?';

    // First, check if the user is in user_tb
    db.query(qUserText, [Email], (err, userResult) => {
        if (err) {
            console.error('Error getting user:', err);
            return res.status(500).json({ message: 'Error getting user' });
        }

        if (userResult.length > 0) {
            // User found in user_tb
            return res.json(userResult);
        } else {
            // Check if the user is in admin_tb
            db.query(qAdminText, [Email], (err, adminResult) => {
                if (err) {
                    console.error('Error getting admin:', err);
                    return res.status(500).json({ message: 'Error getting admin' });
                }

                if (adminResult.length > 0) {
                    // Admin found in admin_tb
                    return res.json(adminResult);
                } else {
                    return res.status(404).json({ message: 'No user or admin found' });
                }
            });
        }
    });
});


app.post('/check_idnumber', (req, res) => {
    const { idNumber } = req.body; // Extract IdNumber from request body
    const query = 'SELECT COUNT(*) AS count FROM user_tb WHERE IdNumber = ?';

    db.query(query, [idNumber], (err, results) => {
        if (err) {
            console.error('Error checking IdNumber:', err);
            return res.status(500).send('Server error');
        }

        const count = results[0].count;
        if (count > 0) {
            res.json({ exists: true }); // ID already exists
        } else {
            res.json({ exists: false }); // ID does not exist
        }
    });
});

app.post('/check_email', (req, res) => {
    const { email } = req.body;
    const qText = 'SELECT * FROM user_tb WHERE LOWER(email) = LOWER(?) LIMIT 1';
    db.query(qText, [email], (err, results) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(500).json({ message: 'Server error' });
        }
        if (results.length > 0) {
            return res.status(200).json({ exists: true });
        } else {
            return res.status(200).json({ exists: false });
        }
    });
});


app.get('/user_tb', (req, res) => {
    const qText = 'SELECT * FROM user_tb';

    db.query(qText, (err, results) => {
        if (err) {
            console.error('Error fetching users', err);
            return res.status.apply(500).json({ message: 'An error occurred while fetching user information.' });
        }

        res.json(results);
    });
});
app.get('/user_tb/:userId', (req, res) => {
    const userId = req.params.userId; // Get UserId from URL parameter and convert to integer
    const query = 'SELECT * FROM user_tb WHERE UserId = ?'; // Use parameterized query for safety

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching users', err);
            return res.status(500).json({ message: 'An error occurred while fetching user information.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No user found with the provided UserId.' });
        }

        res.json(results); // Return matching results
    });
});


// app.post("/new_user_register", upload.fields([{ name: 'FaceImage' }]), async (req, res) => {
//     const { Name, Surname, IdNumber, PassportNumber, Country, Gender, Email, PhoneNumber, Password, DateOfBirth, HomeAddress } = req.body;

//     // Set paths to null if images are not uploaded
//     const faceImagePath = req.files && req.files['FaceImage'] ? `/ID_uploads/${req.files['FaceImage'][0].filename}` : null;
//     const idImagePath = req.files && req.files['ID_Image'] ? `/ID_uploads/${req.files['ID_Image'][0].filename}` : null;
//     const proofImagePath = req.files && req.files['BursaryProofImage'] ? `/ID_uploads/${req.files['BursaryProofImage'][0].filename}` : null;


//     try {
//         const hashedPassword = await bcrypt.hash(Password, saltRounds);

//         const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

//         // If an ID number is provided, store it; otherwise, store passport details
//         let qText;
//         let params;

//         if (IdNumber) {
//             qText = `
//                 INSERT INTO user_tb 
//                 (Name, Surname, IdNumber, Gender, Email, PhoneNumber, FaceImage, Password, Role, ConfirmedUser, DateOfBirth,HomeAddress)
//                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//             `;
//             params = [Name, Surname, IdNumber, Gender, Email.toLowerCase(), PhoneNumber, faceImagePath, hashedPassword, 'User', false, DateOfBirth, HomeAddress];
//         } else if (PassportNumber && Country) {
//             qText = `
//                 INSERT INTO user_tb 
//                 (Name, Surname, PassportNumber, Country, Gender, Email, PhoneNumber, FaceImage, Password, Role, ConfirmedUser,  DateOfBirth, HomeAddress)
//                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//             `;
//             params = [Name, Surname, PassportNumber, Country, Gender, Email.toLowerCase(), PhoneNumber, faceImagePath, hashedPassword, 'User', false, DateOfBirth, HomeAddress];
//         } else {
//             return res.status(400).json({ message: "Either ID number or Passport number and Country must be provided" });
//         }

//         // Execute the query
//         db.query(qText, params, (err, result) => {
//             if (err) { return res.status(500).json({ error: err.message }); }
//             const newUserId = result.insertId;
//             // verifyingSent(Email, newUserId, res);


//             // res.json({ success: true, message: 'Verification code sent to email.', verificationCode });            res.status(201).json({ message: "User created successfully" });
//         });

//         console.log('Face Image Path:', faceImagePath);
//         console.log('ID/Passport Image Path:', idImagePath);
//         console.log('BursaryProofImage Image Path:', proofImagePath);

//     } catch (error) {
//         return res.status(500).json({ error: error.message });
//     }
// });

// app.post("/new_user_register", upload.fields([{ name: 'FaceImage' }]), async (req, res) => {
//     const {
//         Name, Surname, IdNumber, PassportNumber, Country,
//         Gender, Email, PhoneNumber, Password, DateOfBirth,
//         AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode
//     } = req.body;

//     const faceImagePath = req.files?.FaceImage?.[0]?.filename
//         ? `/ID_uploads/${req.files.FaceImage[0].filename}`
//         : null;

//     try {
//         const hashedPassword = await bcrypt.hash(Password, 10);

//         // Step 1: Insert user without HomeAddress for now
//         let userQuery, userParams;

//         if (IdNumber) {
//             userQuery = `
//           INSERT INTO user_tb 
//           (Name, Surname, IdNumber, Gender, Email, PhoneNumber, FaceImage, Password, Role, ConfirmedUser, DateOfBirth)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'User', false, ?)
//         `;
//             userParams = [Name, Surname, IdNumber, Gender, Email.toLowerCase(), PhoneNumber, faceImagePath, hashedPassword, DateOfBirth];
//         } else if (PassportNumber && Country) {
//             userQuery = `
//           INSERT INTO user_tb 
//           (Name, Surname, PassportNumber, Country, Gender, Email, PhoneNumber, FaceImage, Password, Role, ConfirmedUser, DateOfBirth)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'User', false, ?)
//         `;
//             userParams = [Name, Surname, PassportNumber, Country, Gender, Email.toLowerCase(), PhoneNumber, faceImagePath, hashedPassword, DateOfBirth];
//         } else {
//             return res.status(400).json({ message: "Either ID number or Passport number and Country must be provided" });
//         }

//         db.query(userQuery, userParams, (userErr, userResult) => {
//             if (userErr) return res.status(500).json({ error: userErr.message });

//             const newUserId = userResult.insertId;

//             // Step 2: Insert address linked to user
//             const addressQuery = `
//           INSERT INTO address (
//             UserID, AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `;
//             const addressParams = [
//                 newUserId, AddressType, Label, MeantFor,
//                 Address1, Address2 || '', Country, Province, ZipCode
//             ];

//             db.query(addressQuery, addressParams, (addrErr, addrResult) => {
//                 if (addrErr) return res.status(500).json({ error: addrErr.message });

//                 const newAddressId = addrResult.insertId;

//                 // Step 3: Update user with address reference
//                 db.query(
//                     "UPDATE user_tb SET HomeAddressID = ? WHERE UserId = ?",
//                     [newAddressId, newUserId],
//                     (updateErr) => {
//                         if (updateErr) return res.status(500).json({ error: updateErr.message });

//                         res.status(201).json({ message: "User and address created successfully" });
//                     }
//                 );
//             });
//         });
//     } catch (error) {
//         return res.status(500).json({ error: error.message });
//     }
// });

app.post("/new_user_register", upload.fields([{ name: 'FaceImage' }]), async (req, res) => {
    const {
        Name, Surname, IdNumber, PassportNumber, Country,
        Gender, Email, PhoneNumber, Password, DateOfBirth
        // Removed: AddressType, Label, MeantFor, Address1, Address2, Country, Province, ZipCode
    } = req.body;

    const faceImagePath = req.files?.FaceImage?.[0]?.filename
        ? `/ID_uploads/${req.files.FaceImage[0].filename}`
        : null;

    try {
        const hashedPassword = await bcrypt.hash(Password, 10);

        // Step 1: Insert user details only (without any address fields)
        let userQuery, userParams;

        if (Name) {
            userQuery = `
                INSERT INTO user_tb
                (Name, Surname, IdNumber, Gender, Email, PhoneNumber, FaceImage, Password, Role, ConfirmedUser, DateOfBirth)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'User', false, ?)
            `;
            userParams = [Name, Surname, IdNumber, Gender, Email.toLowerCase(), PhoneNumber, faceImagePath, hashedPassword, DateOfBirth || null];
        }

        // else if (PassportNumber && Country) {
        //     userQuery = `
        //         INSERT INTO user_tb
        //         (Name, Surname, PassportNumber, Country, Gender, Email, PhoneNumber, FaceImage, Password, Role, ConfirmedUser, DateOfBirth)
        //         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'User', false, ?)
        //     `;
        //     userParams = [Name, Surname, PassportNumber, Country, Gender, Email.toLowerCase(), PhoneNumber, faceImagePath, hashedPassword, DateOfBirth];
        // }
        else {
            return res.status(400).json({ message: "Either ID number or Passport number and Country must be provided" });
        }

        // Using the promisified query function for consistency and better error handling
        const userResult = await new Promise((resolve, reject) => {
            db.query(userQuery, userParams, (userErr, result) => {
                if (userErr) return reject(userErr);
                resolve(result);
            });
        });

        const newUserId = userResult.insertId;

        // Removed Step 2: Insert address linked to user
        // Removed Step 3: Update user with address reference

        // Respond with success for user creation
        res.status(201).json({ message: "User registered successfully", userId: newUserId });

    } catch (error) {
        console.error('Error during user registration:', error);
        // Check for duplicate entry error specifically
        if (error.code === 'ER_DUP_ENTRY') {
            // You might want to parse the error message to be more specific
            // e.g., "Duplicate entry 'email@example.com' for key 'Email_UNIQUE'"
            return res.status(409).json({ message: "User with this email or ID/Passport number already exists." });
        }
        return res.status(500).json({ error: error.message || "An unexpected error occurred during registration." });
    }
});

app.post('/loginn', (req, res) => {
    const { Email, Password } = req.body;

    const userQuery = `SELECT UserId AS Id,Role,Password From user_tb WHERE Email= ? `;
    const adminQuery = `SELECT AdminId AS Id,Role,AdminPassword As Password From admin_tb WHERE AdminEmail= ? `;


    db.query(userQuery, [Email], (err, users) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({
                message: 'An error occurred during the login process!'
            });
        }

        if (users.length === 0) {
            db.query(adminQuery, [Email], (err, admins) => {

                if (err) {
                    console.error('Login error', err);
                    return res.status(500).json({ message: "No user found with that email address!" });
                }
                if (users[0].Password.toLowerCase().trim() === null) {
                    return res.status(201).json({ message: 'Existing user must create a new password', updatePassword: true, userId: users[0].UserId });
                }

                if (admins.length === 0) {
                    return res.status(401).json({ message: 'No user found with that email address.' });
                }


                bcrypt.compare(Password, admins[0].Password, (err, isValid) => {
                    if (err) {
                        console.error('Error comparing password', err);
                        return res.status(500).json({ message: 'An error occurred while verifying the password.' });
                    }

                    if (!isValid) {
                        return res.status(401).json({ message: 'Incorrect password.' });
                    }

                    res.json({ message: 'Login successful!', userId: admins[0].Id, Role: admins[0].Role });
                });
            });
        }
        else {
            bcrypt.compare(Password, users[0].Password, (err, isValid) => {
                if (users.Password == 'NULL') {
                    console.log('Exitsting user needs to make a new password');
                    return res.status(201).json({ message: 'Existing user must make new password' });
                }

                if (err) {
                    console.error('Error comparing passsword:', err);
                    return res.status(500).json({ message: 'An error occurred while verifying the password.' });
                }

                if (isValid == 'NULL') {
                    console.log('Exitsting user needs to make a new password');
                    return res.status(201).json({ message: 'Existing user must make new password' });
                }

                if (!isValid) {
                    return res.status(401).json({ message: 'Incorrect password.' });
                }

                res.json({ message: "Login successful!", userId: users[0].Id, Role: users[0].Role });
            });
        }
    });

});


app.get('/admin_tb', (req, res) => {
    const qText = 'SELECT * FROM admin_tb ';

    db.query(qText, (err, results) => {
        if (err) {
            console.error('Error fetching admin information:', err);
            return res.status.apply(500).json({ message: 'An error occurred while fetching admin information.' });
        }

        res.json(results);
    });

});


app.get('/admin_tb/:AdminId', (req, res) => {
    const { AdminId } = req.params;
    const qText = "SELECT * FROM admin_tb WHERE AdminId=?";

    db.query(qText, [AdminId], (err, results) => {

        if (err) {
            console.error('Error fetching admin:', err);
            return res.status(404).json({ message: 'An error occurred while fetching the admin.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "Admin not found." });
        }

        res.json(results[0]);
    });
});

app.post("/admin_tb", async (req, res) => {
    const {
        AdminUsername, AdminPassword, AdminName, AdminSurname, AdminEmail,
        Role, BuildingId
    } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(AdminPassword, saltRounds);
        const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const qText = "INSERT INTO admin_tb ( AdminUsername, AdminPassword, AdminName, AdminSurname, AdminEmail, Role, AccountCreatedDate, AdminLastLogin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        db.query(qText, [AdminUsername, hashedPassword, AdminName, AdminSurname, AdminEmail, Role, currentDate, currentDate], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            return res.status(201).json({ message: "Admin created successfully" });
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: error.message });
    }
});



app.listen(port, () => {
    console.log(`Connected to Pongola Server on port ${port}!`)
})