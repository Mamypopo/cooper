// EMVCo PromptPay QR payload generator
function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

export function generatePromptPayPayload(phoneOrId: string, amount?: number): string {
  const normalized = phoneOrId.replace(/[-\s]/g, "");
  const target = normalized.startsWith("0")
    ? `0066${normalized.slice(1)}`
    : normalized;

  const merchantInfo = field("00", "A000000677010111") + field("01", target);

  let payload =
    field("00", "01") +
    field("01", "12") +
    field("29", merchantInfo) +
    field("53", "764");

  if (amount !== undefined && amount > 0) {
    payload += field("54", amount.toFixed(2));
  }

  payload += field("58", "TH") + field("59", "Cooper") + field("60", "Bangkok");
  payload += "6304";
  payload += crc16(payload);

  return payload;
}
