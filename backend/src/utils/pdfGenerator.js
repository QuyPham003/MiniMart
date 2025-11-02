const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const { executeQuery } = require('../config/database');

// Generate PDF invoice
const generateInvoicePDF = async (saleId) => {
  try {
    // Get sale data
    const saleData = await executeQuery(`
      SELECT 
        s.*,
        u.full_name as cashier_name,
        GROUP_CONCAT(
          CONCAT(si.product_name, ' x', si.quantity, ' = ', FORMAT(si.total_price, 0), ' VNĐ')
          SEPARATOR '\n'
        ) as items_detail
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN sale_items si ON s.sale_id = si.sale_id
      WHERE s.sale_id = ?
      GROUP BY s.sale_id
    `, [saleId]);

    if (!saleData || saleData.length === 0) {
      throw new Error('Sale not found');
    }

    const sale = saleData[0];

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa đơn ${sale.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .invoice-info { margin-bottom: 20px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .items-table th { background-color: #f2f2f2; }
          .totals { text-align: right; margin-top: 20px; }
          .total-row { font-weight: bold; font-size: 16px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">SIÊU THỊ MINI</div>
          <div>Địa chỉ: 123 Đường ABC, Quận XYZ, TP.HCM</div>
          <div>Điện thoại: 0123-456-789</div>
        </div>
        
        <div class="invoice-info">
          <h2>HÓA ĐƠN BÁN HÀNG</h2>
          <p><strong>Số hóa đơn:</strong> ${sale.invoice_number}</p>
          <p><strong>Ngày:</strong> ${new Date(sale.created_at).toLocaleString('vi-VN')}</p>
          <p><strong>Thu ngân:</strong> ${sale.cashier_name}</p>
          ${sale.customer_name ? `<p><strong>Khách hàng:</strong> ${sale.customer_name}</p>` : ''}
          ${sale.customer_phone ? `<p><strong>SĐT:</strong> ${sale.customer_phone}</p>` : ''}
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${await getSaleItemsHTML(saleId)}
          </tbody>
        </table>

        <div class="totals">
          <p>Tạm tính: ${sale.subtotal?.toLocaleString('vi-VN')} VNĐ</p>
          ${sale.discount_amount > 0 ? `<p>Giảm giá: -${sale.discount_amount?.toLocaleString('vi-VN')} VNĐ</p>` : ''}
          <p class="total-row">Tổng cộng: ${sale.total_amount?.toLocaleString('vi-VN')} VNĐ</p>
          <p>Tiền nhận: ${sale.cash_received?.toLocaleString('vi-VN')} VNĐ</p>
          <p>Tiền thối: ${sale.change_amount?.toLocaleString('vi-VN')} VNĐ</p>
        </div>

        <div class="footer">
          <p>Cảm ơn quý khách đã mua hàng!</p>
          <p>Hẹn gặp lại quý khách lần sau</p>
        </div>
      </body>
      </html>
    `;

    // Generate PDF
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdf = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    await browser.close();

    return pdf;
  } catch (error) {
    console.error('Generate PDF error:', error);
    throw error;
  }
};

// Get sale items HTML
const getSaleItemsHTML = async (saleId) => {
  try {
    const items = await executeQuery(`
      SELECT product_name, quantity, unit_price, total_price
      FROM sale_items
      WHERE sale_id = ?
    `, [saleId]);

    return items.map(item => `
      <tr>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>${item.unit_price?.toLocaleString('vi-VN')} VNĐ</td>
        <td>${item.total_price?.toLocaleString('vi-VN')} VNĐ</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Get sale items HTML error:', error);
    return '';
  }
};

// Export Excel report
const exportExcelReport = async (reportType, params) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    let data = [];
    let headers = [];

    switch (reportType) {
      case 'revenue':
        data = await getRevenueData(params);
        headers = ['Thời gian', 'Số đơn bán', 'Tổng doanh thu', 'Trung bình/đơn', 'Tổng giảm giá'];
        break;
      case 'products':
        data = await getProductData(params);
        headers = ['Sản phẩm', 'Mã vạch', 'Danh mục', 'Số lượng bán', 'Doanh thu', 'Giá trung bình'];
        break;
      case 'purchases':
        data = await getPurchaseData(params);
        headers = ['Mã phiếu', 'Nhà cung cấp', 'Nhân viên', 'Số sản phẩm', 'Tổng tiền', 'Trạng thái', 'Ngày tạo'];
        break;
      case 'inventory':
        data = await getInventoryData(params);
        headers = ['Sản phẩm', 'Mã vạch', 'Tồn kho hiện tại', 'Tồn kho đầu kỳ', 'Nhập', 'Xuất', 'Điều chỉnh', 'Tồn kho cuối kỳ'];
        break;
    }

    // Add headers
    worksheet.addRow(headers);
    
    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data
    data.forEach(row => {
      worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Export Excel error:', error);
    throw error;
  }
};

// Get revenue data for Excel
const getRevenueData = async (params) => {
  const { start_date, end_date, group_by = 'day' } = params;
  
  let dateFormat = '%Y-%m-%d';
  if (group_by === 'month') dateFormat = '%Y-%m';
  if (group_by === 'year') dateFormat = '%Y';

  const query = `
    SELECT 
      DATE_FORMAT(created_at, '${dateFormat}') as period,
      COUNT(*) as sales_count,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as avg_sale_amount,
      SUM(discount_amount) as total_discounts
    FROM sales
    WHERE DATE(created_at) BETWEEN ? AND ?
    GROUP BY DATE_FORMAT(created_at, '${dateFormat}')
    ORDER BY period
  `;

  const results = await executeQuery(query, [start_date, end_date]);
  return results.map(row => [
    row.period,
    row.sales_count,
    row.total_revenue,
    row.avg_sale_amount,
    row.total_discounts
  ]);
};

// Get product data for Excel
const getProductData = async (params) => {
  const { start_date, end_date, report_type = 'best_selling' } = params;

  let query = '';
  let queryParams = [];

  if (report_type === 'best_selling') {
    query = `
      SELECT 
        p.product_name,
        p.barcode,
        c.category_name,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as total_revenue,
        AVG(si.unit_price) as avg_price
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN sales s ON si.sale_id = s.sale_id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      GROUP BY p.product_id, p.product_name, p.barcode, c.category_name
      ORDER BY total_sold DESC
      LIMIT 50
    `;
    queryParams = [start_date, end_date];
  } else {
    query = `
      SELECT 
        p.product_name,
        p.barcode,
        c.category_name,
        p.current_stock,
        p.min_stock,
        p.sale_price,
        p.purchase_price
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1 AND p.current_stock <= p.min_stock
      ORDER BY p.current_stock ASC
    `;
  }

  const results = await executeQuery(query, queryParams);
  return results.map(row => [
    row.product_name,
    row.barcode || '',
    row.category_name || '',
    row.total_sold || row.current_stock,
    row.total_revenue || row.min_stock,
    row.avg_price || row.sale_price
  ]);
};

// Get purchase data for Excel
const getPurchaseData = async (params) => {
  const { start_date, end_date } = params;

  const query = `
    SELECT 
      po.order_number,
      s.supplier_name,
      u.full_name as staff_name,
      COUNT(poi.product_id) as item_count,
      po.total_amount,
      po.status,
      po.created_at
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
    LEFT JOIN users u ON po.staff_id = u.user_id
    LEFT JOIN purchase_order_items poi ON po.purchase_order_id = poi.purchase_order_id
    WHERE DATE(po.created_at) BETWEEN ? AND ?
    GROUP BY po.purchase_order_id
    ORDER BY po.created_at DESC
  `;

  const results = await executeQuery(query, [start_date, end_date]);
  return results.map(row => [
    row.order_number,
    row.supplier_name,
    row.staff_name,
    row.item_count,
    row.total_amount,
    row.status === 'completed' ? 'Hoàn thành' : row.status === 'cancelled' ? 'Đã hủy' : 'Chờ xử lý',
    new Date(row.created_at).toLocaleDateString('vi-VN')
  ]);
};

// Get inventory data for Excel
const getInventoryData = async (params) => {
  const { start_date, end_date } = params;

  const query = `
    SELECT 
      p.product_name,
      p.barcode,
      p.current_stock,
      COALESCE(opening_stock.opening_stock, 0) as opening_stock,
      COALESCE(total_in.total_in, 0) as total_in,
      COALESCE(total_out.total_out, 0) as total_out,
      COALESCE(total_adjustments.total_adjustments, 0) as total_adjustments
    FROM products p
    LEFT JOIN (
      SELECT 
        product_id,
        SUM(quantity_change) as opening_stock
      FROM inventory_logs
      WHERE DATE(created_at) < ?
      GROUP BY product_id
    ) opening_stock ON p.product_id = opening_stock.product_id
    LEFT JOIN (
      SELECT 
        product_id,
        SUM(quantity_change) as total_in
      FROM inventory_logs
      WHERE DATE(created_at) BETWEEN ? AND ? AND transaction_type = 'in'
      GROUP BY product_id
    ) total_in ON p.product_id = total_in.product_id
    LEFT JOIN (
      SELECT 
        product_id,
        SUM(ABS(quantity_change)) as total_out
      FROM inventory_logs
      WHERE DATE(created_at) BETWEEN ? AND ? AND transaction_type = 'out'
      GROUP BY product_id
    ) total_out ON p.product_id = total_out.product_id
    LEFT JOIN (
      SELECT 
        product_id,
        SUM(quantity_change) as total_adjustments
      FROM inventory_logs
      WHERE DATE(created_at) BETWEEN ? AND ? AND transaction_type = 'adjustment'
      GROUP BY product_id
    ) total_adjustments ON p.product_id = total_adjustments.product_id
    WHERE p.is_active = 1
    ORDER BY p.product_name
  `;

  const results = await executeQuery(query, [start_date, start_date, start_date, end_date, start_date, end_date, start_date, end_date]);
  return results.map(row => [
    row.product_name,
    row.barcode || '',
    row.current_stock,
    row.opening_stock,
    row.total_in,
    row.total_out,
    row.total_adjustments,
    row.opening_stock + row.total_in - row.total_out + row.total_adjustments
  ]);
};

module.exports = {
  generateInvoicePDF,
  exportExcelReport
};
