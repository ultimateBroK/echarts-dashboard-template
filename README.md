# 📊 ECharts Dashboard - Elasticsearch Data Visualization

Dashboard trực quan hóa dữ liệu từ Elasticsearch sử dụng ECharts để hiển thị thống kê báo cáo hệ thống giao thông công cộng.

## 🚀 Tính năng

### 📈 Biểu đồ và thống kê
- **Biểu đồ tròn phân bố nguồn báo cáo** (Facebook, Zalo, Call)
- **Biểu đồ cột top xí nghiệp** có nhiều báo cáo nhất
- **Biểu đồ phân bố loại báo cáo** (Khác, Góp ý, Khen ngợi, etc.)
- **Biểu đồ cấp độ** (Thấp, Trung bình, Cao)
- **Biểu đồ đối tượng** (CNLX, GARA, NVPV)
- **Biểu đồ trạng thái xử lý** (Đã xử lý, Đang xử lý)
- **Biểu đồ top tuyến** có nhiều báo cáo
- **Biểu đồ nội dung báo cáo** chi tiết

### 🔄 Tính năng khác
- Tự động làm mới dữ liệu mỗi 5 phút
- Nút làm mới thủ công
- Responsive design cho mobile và tablet
- Loading states và error handling
- Hiển thị thời gian cập nhật cuối cùng

## 🛠️ Cấu trúc dự án

```
ECharts-test-2/
├── index.html          # Trang chính với layout dashboard
├── styles.css          # CSS styling với thiết kế hiện đại
├── app.js             # JavaScript chính với logic ECharts
└── README.md          # Tài liệu hướng dẫn
```

## 📋 Cài đặt và sử dụng

### 1. Chuẩn bị
- Chỉ cần một web browser hiện đại (Chrome, Firefox, Safari, Edge)
- Không cần cài đặt gì thêm - tất cả dependencies được load từ CDN

### 2. Khởi chạy
```bash
# Mở file index.html trong browser
# Hoặc sử dụng local server
python -m http.server 8000
# Sau đó truy cập http://localhost:8000
```

### 3. Cấu hình Elasticsearch
Trong file `app.js`, cập nhật URL Elasticsearch nếu cần:
```javascript
const ELASTICSEARCH_URL = 'http://124.158.5.222:9400/report_test/_search/';
```

## 🔌 API và dữ liệu

### Elasticsearch Query Structure
Dashboard sử dụng aggregation queries để lấy thống kê:

```json
{
  "size": 0,
  "aggs": {
    "nguon_agg": {
      "terms": {
        "field": "nguon.keyword",
        "size": 10
      }
    },
    "xi_nghiep_agg": {
      "terms": {
        "field": "xi_nghiep.keyword", 
        "size": 15
      }
    }
    // ... more aggregations
  }
}
```

### Mock Data
Nếu không thể kết nối trực tiếp với Elasticsearch (do CORS), dashboard sẽ tự động sử dụng mock data dựa trên thống kê bạn cung cấp:

- **📈 Total Records**: 10,000
- **🏢 Enterprises**: 12
- **🚌 Routes**: 111
- **📱 Sources**: 3 (Facebook, Zalo, Call)

## 🎨 Customization

### Thay đổi màu sắc
Trong `app.js`, tìm các mảng `color` để thay đổi color scheme:

```javascript
color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de']
```

### Thêm biểu đồ mới
1. Thêm container trong `index.html`
2. Thêm chart initialization trong `initializeCharts()`
3. Tạo function update chart mới
4. Gọi function trong `updateAllCharts()`

### Thay đổi refresh interval
Trong `app.js`:
```javascript
// Thay đổi từ 5 phút sang thời gian khác
setInterval(fetchDataAndUpdateCharts, 5 * 60 * 1000); // 5 minutes
```

## 📊 Chi tiết biểu đồ

### 1. Pie Charts
- **Nguồn báo cáo**: Hiển thị tỷ lệ phần trăm theo từng nguồn
- **Loại báo cáo**: Doughnut chart với các loại khác nhau
- **Cấp độ**: Simple pie với 3 levels
- **Đối tượng**: Phân bố theo CNLX, GARA, NVPV
- **Trạng thái**: Đã xử lý vs Đang xử lý

### 2. Bar Charts  
- **Top xí nghiệp**: Horizontal bar chart với gradient
- **Top tuyến**: Vertical bar chart với animation
- **Nội dung báo cáo**: Horizontal bar với nhiều categories

## 🔧 Troubleshooting

### CORS Issues
Nếu gặp lỗi CORS khi kết nối Elasticsearch:
1. Dashboard sẽ tự động fallback sang mock data
2. Để fix: Configure CORS headers trên Elasticsearch server
3. Hoặc sử dụng proxy server

### Performance
- Charts tự động resize khi window resize
- Auto-cleanup memory khi update data
- Optimized cho mobile devices

## 📱 Mobile Support
- Responsive grid layout
- Touch-friendly interactions
- Optimized chart sizes cho small screens
- Collapsible navigation trên mobile

## 🚀 Deployment

### Static Hosting
Upload các files lên bất kỳ static hosting nào:
- GitHub Pages
- Netlify  
- Vercel
- Firebase Hosting

### Production Considerations
- Minify CSS/JS files
- Enable gzip compression
- Add meta tags for SEO
- Configure proper cache headers

## 📈 Metrics Tracked

Dashboard theo dõi các metrics chính:
- **Volume**: Tổng số báo cáo
- **Sources**: Phân bố theo kênh
- **Performance**: Response time của các xí nghiệp
- **Quality**: Loại và nội dung báo cáo
- **Status**: Tình trạng xử lý

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## 📄 License

MIT License - có thể sử dụng tự do cho dự án cá nhân và thương mại.

---

**Liên hệ**: Nếu có thắc mắc về dashboard, vui lòng tạo issue trong repository. 