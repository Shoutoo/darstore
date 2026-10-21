export const PAYMENT_GROUPS = [
  {
    id: 'ewallet_qris',
    title: 'E-Wallet & QRIS (Instan 24 Jam)',
    badge: 'AKTIF',
    minPrice: 1000,
    methods: [
      {
        id: 'gopay',
        name: 'GoPay / QRIS',
        fee: 0,
        image: '/assets/payments/qris_gopay.png',
        channel: 'gopay',
        description: 'Scan QR atau bayar langsung via aplikasi GoPay'
      }
    ]
  },
  {
    id: 'virtual_account',
    title: 'Transfer Bank (Virtual Account Verifikasi Otomatis)',
    badge: 'AKTIF',
    minPrice: 1000,
    methods: [
      {
        id: 'mandiri_va',
        name: 'Bank Mandiri (Livin / VA)',
        fee: 0,
        image: '/assets/payments/va_mandiri.png',
        channel: 'echannel',
        description: 'Bayar via Livin by Mandiri, ATM, atau Internet Banking'
      },
      {
        id: 'bni_va',
        name: 'Bank BNI (Mobile / VA)',
        fee: 0,
        image: '/assets/payments/va_bni.png',
        channel: 'bni_va',
        description: 'Bayar via BNI Mobile Banking, ATM, atau SMS Banking'
      },
      {
        id: 'bri_va',
        name: 'Bank BRI (BRIVA)',
        fee: 0,
        image: '/assets/payments/va_briva.png',
        channel: 'bri_va',
        description: 'Bayar via BRImo, ATM BRI, atau Agen BRILink'
      },
      {
        id: 'cimb_va',
        name: 'CIMB Niaga (OCTO / VA)',
        fee: 0,
        image: '/assets/payments/va_cimb.png',
        channel: 'cimb_va',
        description: 'Bayar via OCTO Mobile, OCTO Clicks, atau ATM CIMB'
      },
      {
        id: 'permata_va',
        name: 'PermataBank (PermataMobile / VA)',
        fee: 0,
        image: '/assets/payments/va_permata.png',
        channel: 'permata_va',
        description: 'Bayar via PermataMobile X, PermataNet, atau ATM'
      }
    ]
  }
];
