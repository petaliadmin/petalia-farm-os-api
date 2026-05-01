export const QUEUE_NAMES = {
  NDVI: "ndvi",
  PDF: "pdf-rapports",
  SMS: "sms",
  ALERTES: "alertes",
  WHATSAPP: "whatsapp",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
