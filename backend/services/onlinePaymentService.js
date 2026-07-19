const { generateReceiptPDF } = require('../utils/generateReceipt');
const { sendReceiptEmail, isEmailConfigured } = require('../utils/sendEmail');

function getCoworkingConfig() {
  return {
    coworkingName: process.env.COWORKING_NAME || 'Thirty Three Space',
    coworkingEmail: process.env.COWORKING_EMAIL || 'contact@33space.tn',
    coworkingTel: process.env.COWORKING_TEL || '+216 XX XXX XXX',
    coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
  };
}

async function finalizeOnlinePayment(supabaseAdmin, paymentId, userId, referenceExterne) {
  const { data: existing } = await supabaseAdmin
    .from('paiements')
    .select('statut')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .single();

  if (existing?.statut === 'paid') {
    const { data: payment } = await supabaseAdmin
      .from('paiements')
      .select(`
        *,
        profiles(nom, prenom, email, telephone),
        reservations(date_debut, date_fin, espaces(nom, type)),
        abonnements(type, date_debut, date_fin)
      `)
      .eq('id', paymentId)
      .single();
    return payment;
  }

  const { data: updatedPayment, error } = await supabaseAdmin
    .from('paiements')
    .update({
      statut: 'paid',
      mode: 'online',
      date_paiement: new Date().toISOString(),
      ...(referenceExterne ? { reference_externe: referenceExterne } : {}),
    })
    .eq('id', paymentId)
    .eq('user_id', userId)
    .select(`
      *,
      profiles(nom, prenom, email, telephone),
      reservations(date_debut, date_fin, espaces(nom, type)),
      abonnements(type, date_debut, date_fin)
    `)
    .single();

  if (error) throw error;

  if (isEmailConfigured()) {
    try {
      const config = getCoworkingConfig();
      const pdfBuffer = await generateReceiptPDF(updatedPayment, config);
      await sendReceiptEmail(updatedPayment, pdfBuffer, config);
    } catch (emailErr) {
      console.error('Avertissement : échec envoi email après paiement Stripe:', emailErr.message);
    }
  }

  return updatedPayment;
}

module.exports = {
  finalizeOnlinePayment,
};
