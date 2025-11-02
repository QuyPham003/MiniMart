const nodemailer = require('nodemailer');

// Email configuration (using environment variables or hardcoded for now)
const EMAIL_USER = process.env.EMAIL_USER || 'trdo1309@gmail.com';
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD || 'prin mkpf ndpl dufd';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Siêu Thị Mini';

// Create transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_APP_PASSWORD
  }
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Connection Error:', error);
  } else {
    console.log('✓ Email Service Ready');
  }
});

/**
 * Generate HTML invoice template
 * @param {Object} invoiceData - Invoice data including sale info and items
 * @returns {String} - HTML string
 */
const generateInvoiceHTML = (invoiceData) => {
  const {
    invoice_number,
    customer_name,
    customer_phone,
    cashier_name,
    items,
    subtotal,
    discount_amount,
    total_amount,
    cash_received,
    change_amount,
    payment_method,
    created_at
  } = invoiceData;

  const paymentMethodText = {
    cash: 'Tiền mặt',
    card: 'Thẻ',
    transfer: 'Chuyển khoản'
  };

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.unit_price).toLocaleString('vi-VN')} VNĐ</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.total_price).toLocaleString('vi-VN')} VNĐ</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hóa đơn ${invoice_number}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="color: #2563eb; margin: 0; font-size: 28px;">🛒 ${EMAIL_FROM_NAME}</h1>
      <p style="color: #6b7280; margin: 5px 0;">Cảm ơn quý khách đã mua hàng!</p>
    </div>

    <!-- Invoice Info -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">HÓA ĐƠN BÁN HÀNG</h2>
      <table style="width: 100%; margin-top: 15px;">
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Số hóa đơn:</td>
          <td style="padding: 5px 0; font-weight: bold; color: #2563eb;">${invoice_number}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Ngày:</td>
          <td style="padding: 5px 0;">${new Date(created_at).toLocaleString('vi-VN')}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Khách hàng:</td>
          <td style="padding: 5px 0;">${customer_name || 'Khách lẻ'}</td>
        </tr>
        ${customer_phone ? `
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Điện thoại:</td>
          <td style="padding: 5px 0;">${customer_phone}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Thu ngân:</td>
          <td style="padding: 5px 0;">${cashier_name || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <!-- Items Table -->
    <div style="margin-bottom: 30px;">
      <h3 style="color: #1f2937; margin-bottom: 15px;">Chi tiết sản phẩm</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Sản phẩm</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">SL</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Đơn giá</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <!-- Payment Summary -->
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Tạm tính:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: 500;">${Number(subtotal).toLocaleString('vi-VN')} VNĐ</td>
        </tr>
        ${discount_amount > 0 ? `
        <tr>
          <td style="padding: 5px 0; color: #ef4444;">Giảm giá:</td>
          <td style="padding: 5px 0; text-align: right; color: #ef4444; font-weight: 500;">-${Number(discount_amount).toLocaleString('vi-VN')} VNĐ</td>
        </tr>
        ` : ''}
        <tr style="border-top: 2px solid #e5e7eb;">
          <td style="padding: 10px 0; font-size: 18px; font-weight: bold; color: #1f2937;">TỔNG CỘNG:</td>
          <td style="padding: 10px 0; text-align: right; font-size: 20px; font-weight: bold; color: #2563eb;">${Number(total_amount).toLocaleString('vi-VN')} VNĐ</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Tiền nhận:</td>
          <td style="padding: 5px 0; text-align: right;">${Number(cash_received).toLocaleString('vi-VN')} VNĐ</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Tiền thối:</td>
          <td style="padding: 5px 0; text-align: right; color: #10b981; font-weight: 500;">${Number(change_amount).toLocaleString('vi-VN')} VNĐ</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280;">Phương thức:</td>
          <td style="padding: 5px 0; text-align: right;">${paymentMethodText[payment_method] || payment_method}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280;">
      <p style="margin: 5px 0; font-size: 14px;">✨ Cảm ơn quý khách! Hẹn gặp lại! ✨</p>
      <p style="margin: 5px 0; font-size: 12px;">Đây là email tự động, vui lòng không trả lời.</p>
      <p style="margin: 10px 0; font-size: 12px; color: #9ca3af;">
        ${EMAIL_FROM_NAME} | Email: ${EMAIL_USER}
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send invoice email to customer
 * @param {String} customerEmail - Customer's email address
 * @param {Object} invoiceData - Invoice data
 * @returns {Promise} - Email send result
 */
const sendInvoiceEmail = async (customerEmail, invoiceData) => {
  try {
    // Skip if no customer email
    if (!customerEmail || !customerEmail.trim()) {
      console.log('⊘ No customer email provided, skipping email send');
      return { success: false, message: 'No email provided' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      console.log('⊘ Invalid email format:', customerEmail);
      return { success: false, message: 'Invalid email format' };
    }

    const htmlContent = generateInvoiceHTML(invoiceData);

    const mailOptions = {
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
      to: customerEmail,
      subject: `Hóa đơn ${invoiceData.invoice_number} - ${EMAIL_FROM_NAME}`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✓ Invoice email sent successfully to ${customerEmail}`);
    console.log('Message ID:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('✗ Error sending invoice email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send email'
    };
  }
};

module.exports = {
  sendInvoiceEmail,
  generateInvoiceHTML
};

