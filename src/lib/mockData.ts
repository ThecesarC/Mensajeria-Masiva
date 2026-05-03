import { Contact, Campaign, Message } from '../types';

export const mockContacts: Contact[] = [
  { id: '1', name: 'Alvaro García', phoneNumber: '+34600111222', tags: ['Client', 'VIP'] },
  { id: '2', name: 'Beatriz López', phoneNumber: '+34600333444', tags: ['Lead'] },
  { id: '3', name: 'Carlos Ruiz', phoneNumber: '+34600555666', tags: ['Standard'] },
  { id: '4', name: 'Diana Prince', phoneNumber: '+12025550101', tags: ['Global'] },
  { id: '5', name: 'Elena Nito', phoneNumber: '+34600777888', tags: ['Friend'] },
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Promoción Verano 2024',
    status: 'completed',
    totalMessages: 1500,
    sent: 1500,
    delivered: 1485,
    failed: 15,
    createdAt: new Date('2024-05-01T10:00:00')
  },
  {
    id: 'c2',
    name: 'Recordatorio Evento Tech',
    status: 'paused',
    totalMessages: 500,
    sent: 250,
    delivered: 240,
    failed: 10,
    createdAt: new Date('2024-05-02T09:30:00')
  }
];

export const mockMessages: Message[] = [
  {
    id: 'm1',
    contactId: '1',
    contactName: 'Alvaro García',
    phoneNumber: '+34600111222',
    content: '¡Hola Alvaro! Ya tienes disponible tu cupón de descuento 🚀',
    status: 'read',
    channel: 'sms',
    timestamp: new Date()
  },
  {
    id: 'm2',
    contactId: '2',
    contactName: 'Beatriz López',
    phoneNumber: '+34600333444',
    content: 'Tu pedido ha sido enviado. Puedes rastrearlo aquí: https://link.com/track',
    status: 'delivered',
    channel: 'sms',
    timestamp: new Date()
  },
  {
    id: 'm3',
    contactId: '3',
    contactName: 'Carlos Ruiz',
    phoneNumber: '+34600555666',
    content: 'Mañana tenemos una cita a las 10:00 AM. ¡Te esperamos!',
    status: 'failed',
    channel: 'whatsapp',
    timestamp: new Date()
  }
];
