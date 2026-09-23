# Pigeon Flight Lab · phiên bản 2.0

[English README](README.md) · [Giấy phép MIT](LICENSE)

Mô hình tương tác bằng tiếng Việt để khảo sát đàn **Rock Pigeon / Columba livia** gặp máy bay dân dụng trong không gian 3D. Có quỹ đạo cất/hạ cánh, giao cắt tâm danh định, tín hiệu âm/ánh sáng, tác tử chim cắt robot và dự báo chuyển động. Đây là mô hình thăm dò tự xây dựng, chưa hiệu chuẩn xác suất bird strike thực tế.

## Mở ngay

Mở `dist/Bo-cau-lab.html` bằng Chrome, Edge, Firefox hoặc Safari hiện đại. Tệp chứa toàn bộ giao diện và mô hình; không cần mạng hay cài thư viện. Các liên kết nghiên cứu cần mạng nếu bạn muốn đọc nguồn.

## Chạy trên localhost

Giải nén toàn bộ thư mục, chọn một cách:

- Python 3: `python3 start-local.py`; Windows: `py -3 start-local.py`. Trình duyệt tự mở. Có thêm `START-WINDOWS.bat` và `START-MAC.command`.
- Node.js 18+: `node server.mjs`.

Mở **http://localhost:4173/** trên chính máy chạy lệnh. Giữ cửa sổ lệnh mở; Ctrl+C để dừng. Không cần `npm install`. Nếu cổng bị chiếm, chương trình báo lỗi và không dừng chương trình khác.

## Cách khảo sát phiên bản mới

1. Chọn **Hạ cánh** hoặc **Cất cánh**. Bật **Khóa giao cắt tâm dự kiến** để máy bay và tâm đàn theo vận tốc ban đầu gặp đúng một điểm. Cao độ ban đầu của máy bay được tự tính; vận tốc đứng thay đổi dấu theo pha bay.
2. Chọn **Đối chứng · tâm không đổi vận tốc** để tắt các lực điều chỉnh và phản ứng của từng chim. Sai lệch quỹ đạo tâm danh định bằng 0; điều này không bảo đảm mọi cá thể nằm trong khối máy bay.
3. Chọn **Thử giả thuyết âm + đèn**, mở mục 04. Bỏ chọn **Thử giả thuyết: vượt mốc tín hiệu → né** để chỉ đo tín hiệu. So sánh với cùng hạt giống: chỉ đo không được làm đổi quỹ đạo chim.
4. Chọn **Chim cắt robot** để thêm tác tử săn đuổi. Nó là đối tượng riêng; âm đơn tần và màu đèn không được coi là hình/tiếng loài săn mồi.
5. Quan sát bảng dự báo CV, cận tiếp tâm đàn, hướng né được chọn và RMSE. Đường cam giữ vận tốc hiện tại trong H giây; đây là dự báo động học có thể sai khi chim rẽ.
6. **Chạy mô phỏng** hiển thị theo thời gian; **Xem kết quả** tính đến hết. Tạm dừng bằng phím cách khi không nhập liệu. Đổi tham số luôn bắt đầu lượt mới.
7. Mục 06 xuất CSV từng chim hoặc JSON diễn biến tâm đàn và sự kiện. Giữ hạt giống không đổi khi so sánh.

## Vì sao chim né?

Trong bản 1, chim né do quy tắc bán kính phát hiện máy bay, chờ độ trễ rồi đổi hướng; chưa có âm thanh/ánh sáng. Bản 2 ghi lại **kênh đầu tiên** kích hoạt chờ né: máy bay, âm thanh, ánh sáng, robot hoặc phản ứng của láng giềng.

Các tác tử duy trì tốc độ, đồng hướng, giữ đàn và tránh láng giềng. Quy tắc mặc định chọn hướng ngang vuông góc với hướng di chuyển của đối tượng kích hoạt phản ứng, về phía cá thể đang đứng, kết hợp một phần hướng ban đầu. Gia tốc hữu hạn nên vận tốc không đổi ngay lập tức. Đây là quy tắc phỏng theo ý tưởng của HoPE, không phải bản sao thuật toán gốc hay khẳng định mọi bồ câu luôn né một phía. Tùy chọn cùng rẽ, tách hai bên hoặc hạ thấp là các giả thuyết so sánh.

Không có dữ liệu trong các nguồn dưới đây bảo đảm một âm, một màu đèn hay mô phỏng loài săn mồi gây sợ/né tuyệt đối. Nghe, nhìn, bắt đầu né và tránh kịp là những sự kiện khác nhau.

## Phương trình và phạm vi

### Cắt tâm và quỹ đạo máy bay

Khi khóa tâm, vị trí ban đầu được căn sao cho:

`p_plane(0) + v_plane * T = center(0) + mean_velocity(0) * T`

với `T = distance / (plane_vx - initial_bird_vx)`. Dấu cộng trên bản vẽ là điểm hẹn cố định này. Máy bay **không tự đuổi theo tâm đàn sau khi chim rẽ**. Sai lệch bằng 0 là thuộc tính toán học của quỹ đạo danh định, không phải độ chính xác dự báo va chạm ngoài thực tế 100%.

Vận tốc đứng: `vz = ±groundspeed * tan(flightAngle)`. Mặc định hạ cánh 3° tham chiếu đường lượn ILS thông thường của FAA; góc cất cánh là giả định. Chỉ mô phỏng đoạn bay sau nhấc bánh hoặc tiếp cận cuối, chưa có chạy đà, rotation, flare hay chạm bánh. Cấu hình đặt máy bay dưới mặt đất bị chặn. Tiếp cận kết thúc khi cao độ tâm máy bay xuống dưới giới hạn 3 m.

Sáu khối hộp không xoay theo góc đường bay đại diện hình học máy bay. Chiều dài/sải cánh tham chiếu A320; các chi tiết khối là đơn giản hóa. Mỗi mặt nới 0,18 m đại diện kích thước chim. Phép quét chuyển động tương đối tại mỗi bước 1/60 s kiểm tra giao cắt để không bỏ sót vật thể đi nhanh qua khối. Không dự báo thương tích, hư hại hoặc hút động cơ. Chim đã giao cắt được loại khỏi tương tác; tâm sau đó tính trên chim còn bay.

### Âm thanh

Nguồn điểm gắn máy bay bắt đầu phát ở t = 0, với một tần số lựa chọn. SPL không trọng số, cùng dải tần, không phải dBA hay phổ tiếng động cơ thực.

- `L_received = L_1m - 20 log10(r)` trong trường tự do, dùng khoảng truyền từ vị trí nguồn lúc phát.
- Có thời gian truyền và Doppler của nguồn/đích; vận tốc âm giả định 343 m/s, không khí đứng yên. Chưa tính hấp thụ, che khuất, phản xạ, hướng phát hoặc biến đổi biên độ do nguồn chuyển động.
- Heffner cung cấp hai mốc trung bình: xấp xỉ 14 dB SPL ở vùng nhạy nhất 1–4 kHz, và dải 54–6.400 Hz tại 60 dB SPL. Bản này dùng mốc sàng lọc bảo thủ 60 dB ngoài vùng nhạy nhất; không nội suy audiogram chi tiết.
- `criterion = max(reference, noise + margin)` là quy tắc sàng lọc, chưa phải mô hình che lấp âm được hiệu chuẩn. Ngoài miền tần số tham chiếu, trả về “chưa kết luận”, không suy thành không nghe được.
- Nút nghe thử phát âm nhỏ 0,4 s do người dùng bấm. Âm lượng loa không tái hiện dB SPL trong mô hình; không phát thử 20 kHz.

### Ánh sáng và chim cắt

`E = I/r²`, với I theo mW/sr và E hiển thị theo µW/m². Dòng photon dùng `E*lambda/(h*c)`. Nguồn không bị che khuất; nhịp chớp duty cycle 50%, 0 Hz là sáng liên tục. Màu trên màn hình chỉ minh họa. Không dùng lux của người làm độ nhạy chim, không gán trọng số gây sợ theo bước sóng.

Ngưỡng sáng và việc **vượt mốc → bắt đầu chờ né** hoàn toàn là giả thuyết. Khi tắt giả thuyết, nguồn âm/đèn không tác động lực chuyển động. Nguồn vẫn được đo và ghi nhận nếu vượt mốc.

Tác tử chim cắt phỏng theo chế độ tấn công của HoPE: đuổi chim gần nhất với tốc độ 1,5 lần tốc độ nền, vùng kích hoạt 50 m. Bản này đơn giản hóa sự đổi hướng tức thời của robot và chưa tính bắt mồi hoặc va chạm robot–máy bay.

### Dự báo và hướng né

CV: `p(t+H) = p(t) + v(t)*H`. Mỗi 0,2 s lưu dự báo từng chim; sau H giây so với vị trí mô phỏng, tích lũy RMSE và loại chim đã giao cắt. RMSE không phải độ chính xác trên dữ liệu GPS ngoài thực tế.

Vòng cam bán kính `0.5 * a_max * H²` là biên động học theo gia tốc giả định cho cùng nhóm cá thể còn bay, không chạm sàn; không phải khoảng tin cậy hay xác suất. Khi cá thể bị loại sau giao cắt, tâm của nhóm mới có thể nhảy ra ngoài biên của nhóm cũ.

+X là hướng ngang máy bay; +Y ở bên trái, −Y ở bên phải máy bay; +Z hướng lên. Số chim né trái/phải dựa trên **hướng đích được chọn ở thời điểm bắt đầu né**, không phải vận tốc tức thời. Né xuống có thể đồng thời rẽ ngang.

## Nguồn và mức độ áp dụng

Đối chiếu ngày 23/09/2026. Các liên kết cũng nằm trong giao diện.

| Nguồn | Áp dụng |
|---|---|
| [HoPE / Papadopoulou et al., 2022](https://doi.org/10.1371/journal.pcbi.1009772) | Tham số mô hình đã công bố: tốc độ nền 16 m/s, tốc độ ưa thích ±2 m/s, 7 láng giềng, tách 1 m, cửa sổ tương tác 215°. Đây không phải toàn bộ thị trường nhìn giải phẫu. Bản 3D này không tái lập HoPE. |
| [Heffner et al., 2013](https://doi.org/10.3758/s13428-012-0269-y) | Mốc nghe bồ câu trong thí nghiệm; không phải khoảng cách tránh máy bay hoặc hiệu quả xua đuổi. |
| [Woronecki / USDA, 1988](https://digitalcommons.unl.edu/vpcthirteen/54/) | Thử thiết bị trên bồ câu trong tòa nhà: không giảm số lượng bền vững; siêu âm không hiệu quả trong thử nghiệm. |
| [Nebel et al., 2019](https://doi.org/10.1098/rsos.190677) | Ánh sáng môi trường tối hơn làm phản ứng với mô hình diều hâu chậm hơn; chỉ giữ kết luận định tính. |
| [Đèn tương phản, 2018](https://pubmed.ncbi.nlm.nih.gov/30280013/) | Hiệu ứng 470/630 nm thử trên brown-headed cowbird, không chuyển thành hiệu quả ở bồ câu. |
| [FAA AIM, ILS](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html) | Góc đường lượn thông thường 3° cho mặc định hạ cánh. |
| [OSHA Technical Manual](https://www.osha.gov/otm/section-3-health-hazards/chapter-5) | Giảm khoảng 6 dB khi gấp đôi khoảng cách với nguồn âm điểm trong trường tự do. |
| [FAA Wildlife FAQ](https://www.faa.gov/airports/airport_safety/wildlife/faq) | Khoảng 70% vụ bird strike báo cáo ở 0–500 ft AGL, thống kê nhiều loài; không phải xác suất của lượt này hoặc ngưỡng cao độ an toàn. |
| [DeVault et al., 2017](https://digitalcommons.unl.edu/icwdm_usdanwrc/1876/) | Bồ câu với video xe tiếp cận: nhận biết không bảo đảm tránh kịp; không quy đổi sang ngưỡng máy bay. |
| [Airbus A320, 06/2024](https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-01/AC_A320_0624.pdf) | Chiều dài 37,57 m, sải cánh 35,80 m của bản có sharklet. |
| [Blackwell et al., 2019](https://doi.org/10.1002/jwmg.21650) | Dữ liệu sân bay có mourning dove, không phải rock pigeon; không dùng để gán một khoảng phản ứng cho bồ câu. |

Các mặc định **220 m, 0,6 s, gia tốc 12 m/s², lan truyền 0,15 s**, nguồn âm 100 dB SPL tại 1 m, nền 40 dB, biên 6 dB, ngưỡng sáng 1 µW/m², các trọng số lực, tốc độ tối đa 28 m/s, tốc độ đứng 5 m/s và sàn 2 m là **giả định khảo sát**. Biến thiên phát hiện/độ trễ ±15% cũng là giả định, không phải phân bố đo được.

Chưa tính gió, khí động, wake turbulence, hút động cơ, che khuất thị giác, xác suất có đàn hay phản ứng phi công. Không tự nhân hệ số theo mùa. Trục cao và biểu tượng chim phóng đại để đọc hình.

## Dữ liệu xuất

- **CSV**: một dòng/chim; trạng thái, phát hiện máy bay, kênh kích hoạt đầu tiên, thời điểm vượt mốc âm/đèn, SPL/tần số khi vượt mốc âm lần đầu, phản ứng, hướng đích né, vị trí/vận tốc cuối, giao cắt, cận tiếp, cấu hình và chỉ số CV. `reaction_aircraft_distance_m` luôn là cự ly tới máy bay, kể cả khi robot kích hoạt. Hướng đích là vector đơn vị. Giá trị trống là chưa quan sát hoặc chưa xác định.
- **JSON**: tham số, kết quả, tất cả sự kiện và chuỗi 0,2 s của máy bay/tâm đàn, vận tốc trung bình, dự báo, RMSE, CPA và tín hiệu. Vị trí/vận tốc chuỗi dùng SI. Tham số `aircraftAlt`, `birdAlt` theo ft; `speed` theo kt. Khi khóa tâm, dùng `initialAircraftAltitudeFt` để biết cao độ ban đầu thực sự được tự căn.
- Cả hai ghi trạng thái lượt hoàn tất hay đang chạy. `validPlan=false` nghĩa cấu hình bị chặn trước khi chạy; không coi là một lượt thử hoàn thành hợp lệ.
- Cùng tham số và hạt giống cho cùng kết quả. Tốc độ phát không thay đổi bước vật lý 1/60 s.

## Mã và kiểm tra

- `dist/model.mjs`: tác tử, quỹ đạo, giao cắt, dự báo, hạt giống.
- `dist/sensors.mjs`: truyền âm, Doppler, mốc nghe, năng lượng ánh sáng.
- `dist/app.mjs`: điều khiển, canvas, xuất dữ liệu, nghe âm mẫu.
- `dist/index.html`, `dist/style.css`: giao diện và nguồn nghiên cứu.
- `node --test tests/*.test.mjs`: kiểm tra hình học quét, pha bay/khóa tâm, tái lập, chế độ đối chứng, sự độc lập của đo tín hiệu, kích hoạt theo kênh, dự báo, vật lý âm và ánh sáng.
- `node build.mjs`: tạo lại `dist/Bo-cau-lab.html` sau khi sửa mã.

WebMCP được tích hợp theo feature detection, dùng cùng trạng thái với giao diện. Không có `document.modelContext` thì các chức năng thông thường vẫn hoạt động.
