# Collaboration Design Decisions

## 1. ทำไมเลือก Pusher?

เลือก Pusher เพราะไม่อยากมานั่งจัดการ infrastructure ของ WebSocket เองครับ

ถ้าใช้ Socket.io ตรงๆ พอ scale เป็นหลาย instance ต้องเพิ่ม Redis Adapter
ต้องเขียน reconnect logic เอง ต้องจัดการ rooms เอง มันมีสิ่งที่ต้องดูแลเยอะ
และแต่ละอย่างก็เป็น source of bugs ได้หมด

Pusher เป็น managed service ที่แก้ปัญหาพวกนี้ให้แล้ว แค่เอา API key มาใส่ก็ใช้งานได้เลย
ให้ทีมโฟกัสที่ product logic แทนที่จะมานั่ง debug WebSocket scaling ครับ

---

## 2. Client events กับ server events ต่างกันอย่างไร?

**Client events** — Frontend ยิงหากัน peer-to-peer โดยไม่ผ่าน backend เลย
ใช้กับข้อมูลที่ไม่ต้องบันทึก เช่น cursor movement ที่อัปเดตทุก 100ms
ถ้าผ่าน backend ทุกครั้งจะกิน request มากเกินไปครับ

**Server events** — backend เป็นคนยิงเท่านั้น ใช้กับทุก mutation ที่บันทึกลง DB แล้ว
เช่น clip.move หรือ effect.update เพราะต้องมั่นใจว่าข้อมูลทุกคนตรงกับ DB จริงๆ
ไม่ใช่ตรงกันแบบ "อาจจะ" ครับ

---

## 3. Cursor movement ควร throttle เท่าไหร่?

ตั้งไว้ที่ **100ms** (10 ครั้ง/วินาที) ครับ

ลอง 50ms แล้วรู้สึกว่ากิน Pusher quota เปล่าๆ เพราะสายตาคนแยกไม่ออกอยู่แล้ว
ลอง 500ms แล้ว cursor มันกระตุกจนดูไม่เป็นธรรมชาติ วาร์ปข้ามจุดไปเลย

100ms เป็นจุดที่ดูสมูทพอ และไม่กิน quota มากเกินจำเป็นครับ

---

## 4. ถ้า client offline แล้ว reconnect จะ sync state อย่างไร?

Frontend เก็บ `last_seen_server_seq` ไว้ใน `useRef` ตลอดเวลาครับ

พอ Pusher แจ้งว่า reconnect สำเร็จ จะยิง API ทันทีว่า
`GET /projects/:id/operations?afterSeq={last_seen_server_seq}`

Backend ส่ง operations ที่หายไปกลับมา แล้ว client apply ตามลำดับ `server_seq`
State ก็จะกลับมาตรงกับ DB เป๊ะครับ

แต่ถ้าหลุดนานมากจน gap เกิน 100 operations จะ reload project ทั้งหมดแทน
เพราะ apply ทีละ operation 100+ ครั้งมันช้าและเสี่ยง edge case มากกว่าการ fetch ใหม่ครับ

---

## 5. OperationLog ใช้แก้ปัญหา missed events อย่างไร?

`OperationLog` คือ source of truth ของทุก mutation ในโปรเจกต์ครับ

Pusher เป็น best-effort delivery ซึ่งหมายความว่า event อาจหายได้ในบางกรณี
ถ้า rely แค่ Pusher อย่างเดียว client ที่เน็ตไม่ดีจะมี state ไม่ตรงกับคนอื่นโดยไม่รู้ตัว

การเก็บ `server_seq` เรียงต่อกันใน DB ทำให้เรามี "ประวัติ" ที่ query ย้อนหลังได้เสมอ
Pusher ทำหน้าที่แจ้งแบบ real-time เท่านั้น OperationLog คือ fallback ครับ

---

## 6. ถ้าเกิน Pusher limit จะ migrate ไป architecture แบบไหน?

ถ้าถึงจุดที่ Pusher ไม่คุ้มค่าแล้ว คงย้ายไปทำ WebSocket server เองครับ
น่าจะใช้ `ws` หรือ Socket.io แล้วครอบด้วย Redis Pub/Sub
เพื่อให้หลาย instance ยิง event ข้ามกันรู้เรื่องได้

โครงสร้างหลักยังเหมือนเดิมครับ เพราะ OperationLog และ server_seq
ยังทำงานแบบเดิมได้เลย แค่เปลี่ยน transport layer ออกไปครับ

---

## 7. ทำไมไม่ implement full CRDT ใน scope นี้?

อ่านเรื่อง CRDT มาพอสมควรครับ หลักการน่าสนใจมาก
แต่ราคาที่ต้องจ่ายสำหรับโปรเจกต์ระยะแรกมันสูงเกินไป

ต้องออกแบบ data structure ใหม่ทั้งหมดให้รองรับ merge
ขนาดข้อมูลบวมขึ้นเรื่อยๆ และ debugging มันยากกว่า last-write-wins มาก

Last-write-wins ตาม `server_seq` ง่ายกว่า ทดสอบง่ายกว่า
และสำหรับ video editor ที่ user มักไม่ได้แก้ field เดียวกันพร้อมกัน
มันก็เพียงพอครับ

---

## 8. ถ้าจะใช้ Yjs / Automerge จะออกแบบอย่างไร?

ถ้า product ซับซ้อนขึ้นจนต้องการ real-time undo/redo แบบ Figma
คงพิจารณา Yjs มาครอบ Timeline state ใน Zustand ครับ

แทนที่จะส่ง operation payload ข้ามไปมา
จะเปลี่ยนเป็นส่ง binary update ของ Yjs ผ่าน WebSocket แทน
และรัน `y-websocket` server เพิ่มสักตัวเพื่อเก็บ document state ล่าสุดลง DB

แต่ตอนนี้ระบบที่ทำอยู่ยังรองรับ use case ของ CloudCut ได้ดีครับ
จะ migrate เมื่อมีความจำเป็นจริงๆ ดีกว่า over-engineer ตั้งแต่ต้น
