// Centralized application state
export const appState = {
  activeView: 'home-view',
  currentUser: null,
  
  ml: {
    selectedNominal: null,
    qty: 1,
    selectedPayment: null,
    userId: '',
    server: '',
    email: '',
    wa: ''
  },
  
  valo: {
    selectedNominal: null,
    qty: 1, // Fixed 1 per instructions
    selectedPayment: null,
    riotId: '',
    email: '',
    wa: ''
  },
  
  currentInvoice: null
};
