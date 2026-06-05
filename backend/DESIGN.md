# Backend Design Decisions

> โปรเจกต์นี้ใช้ Node.js + TypeScript แทน Rust ตามที่ตกลงกับทีมไว้ครับ
> คำตอบด้านล่างจึงอ้างอิงจาก stack จริงที่ใช้

---

## 1. ทำไมเลือก Fastify แทน Axum/Actix?

เลือก Fastify เพราะทีมถนัด TypeScript และต้องการ dev speed ที่เร็วกว่าครับ

ข้อดีที่ชัดเจนคือ share type กับ frontend ได้โดยตรง Zod schema เดียวกัน
ใช้ได้ทั้งสองฝั่ง ไม่ต้องเขียน validation ซ้ำสองที่

ด้าน performance Fastify เป็น framework ที่เร็วที่สุดใน Node.js ecosystem
มี benchmark ที่ใกล้เคียงกับ Express มากพอสำหรับ use case นี้ครับ

---

## 2. ทำไมเลือก Prisma แทน SQLx/SeaORM?

Prisma generate TypeScript types จาก schema ให้อัตโนมัติครับ
ทำให้ผิดพลาดเรื่องชื่อ column หรือ type ได้ยากมาก compiler จับให้ก่อน runtime

Migration workflow ก็ straightforward กว่า เขียน schema เปลี่ยน
รัน `prisma migrate dev` ได้เลย ไม่ต้องเขียน SQL migration เองทุกครั้ง

trade-off ที่ยอมรับคือ Prisma ไม่ยืดหยุ่นเท่า raw SQL สำหรับ query ซับซ้อนมากๆ
แต่สำหรับ CRUD ที่โปรเจกต์นี้ต้องการ มันเพียงพอครับ

---

## 3. Cursor-based pagination ทำงานอย่างไร?

ใช้ `updated_at` + `id` เป็น cursor ครับ เหตุผลที่ไม่ใช้ offset เพราะถ้ามีข้อมูลใหม่
insert เข้ามาระหว่างที่ user กำลัง scroll หน้า offset จะเลื่อน
ทำให้เห็นข้อมูลซ้ำหรือข้ามไปได้

cursor encode เป็น Base64 ก่อนส่งให้ client เพื่อไม่ให้ฝั่ง client
รู้ว่า internal format เป็นอะไร และ query ตรงๆ ได้

```
cursor = base64({ updated_at: "2026-01-01T00:00:00Z", id: "uuid" })
WHERE (updated_at, id) < (cursor.updated_at, cursor.id)
ORDER BY updated_at DESC, id DESC
LIMIT 20
```

---

## 4. Presigned upload flow ทำงานอย่างไร?

```
1. Client → POST /assets/presigned-url (บอก filename + content type)
2. Backend เช็คสิทธิ์ → ขอ presigned URL จาก MinIO/S3
3. Backend ส่ง URL กลับให้ client (มีอายุ 15 นาที)
4. Client PUT ไฟล์ตรงไป MinIO โดยไม่ผ่าน backend
5. Client → POST /assets/confirm-upload
6. Backend สร้าง Asset row + enqueue ProcessingJob
```

---

## 5. ทำไมไม่ upload ผ่าน backend โดยตรง?

ไฟล์วิดีโอขนาด 1GB ถ้าผ่าน backend จะเจอปัญหาสองอย่างครับ

อย่างแรกคือ bandwidth server จะถูกใช้สองเท่า รับจาก client แล้วส่งต่อไป S3
อย่างที่สองคือต้อง buffer ไฟล์ใน memory หรือ disk ก่อน ซึ่งเสี่ยง OOM
และทำให้ request ยาวมากจน timeout ได้

Presigned URL ให้ client คุยกับ storage โดยตรง backend แค่ออก token
ไม่ต้องแบกรับ traffic ของไฟล์ขนาดใหญ่เลยครับ

---

## 6. Batch clip operation ควร atomic หรือ partial success?

Atomic ครับ ไม่มีข้อยกเว้น

Timeline เป็นข้อมูลที่ทุก clip มีความสัมพันธ์กัน ถ้า batch ย้าย 5 clips
แล้วสำเร็จแค่ 3 ตัว timeline จะอยู่ในสถานะที่ไม่ถูกต้องและแก้ยากมาก

ใช้ Prisma transaction ครอบทั้ง batch แล้ว throw error ถ้ามีอะไรผิดพลาด
Prisma rollback ให้อัตโนมัติครับ

---

## 7. API versioning จะจัดการอย่างไรถ้ามี breaking change?

ใช้ URL versioning ครับ `/v1/` และ `/v2/`

เมื่อมี breaking change จะสร้าง route ใหม่ใน `/v2/` และ keep `/v1/` ไว้
จนกว่า client ทุกตัวจะ migrate มาหมด แล้วค่อย deprecate `/v1/` ออก

เหตุผลที่เลือก URL versioning แทน header versioning เพราะ debug ง่ายกว่า
เห็นจาก URL เลยว่ากำลังเรียก version ไหน ไม่ต้องไปดู request header ครับ

---

## 8. Authorization layer วางไว้ที่ไหน?

แบ่งเป็นสองชั้นครับ

**Authentication (middleware)** — ตรวจ JWT และ decode user ออกมา
ทำที่ Fastify hook ก่อนที่ request จะเข้า route handler

**Authorization (service layer)** — ตรวจ role และ permission
ทำใน service เพราะบางกรณีต้องดึงข้อมูลจาก DB ก่อนถึงจะตัดสินใจได้
เช่น ต้องเช็คว่า user เป็น WorkspaceMember และมี role อะไรก่อน

middleware ไม่รู้ context ของ resource ที่กำลัง access
เพราะฉะนั้นการเช็ค role ใน service layer จึง correct กว่าครับ

---

## 9. Error handling strategy เป็นอย่างไร?

สร้าง typed errors ไว้กลาง เช่น `NotFoundError`, `ForbiddenError`, `ValidationError`
แต่ละ error มี statusCode และ message ติดมาด้วย

service layer `throw` error ออกมาได้เลยโดยไม่ต้องสร้าง response เอง
Fastify global error handler คอยดักแล้วแปลงเป็น response format มาตรฐาน

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You don't have editor access to this project",
  "requestId": "req_01HX..."
}
```

ข้อดีคือทุก endpoint ได้ format เดียวกันโดยอัตโนมัติ
ไม่มีใครลืม handle error แล้วส่ง 500 กลับไปแบบ unformatted ครับ
