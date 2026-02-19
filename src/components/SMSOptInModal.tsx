import { useState, useEffect } from 'react';
import { X, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';

interface SMSOptInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SMSOptInModal({ isOpen, onClose }: SMSOptInModalProps) {
  const { user, salesPerson } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasConsented, setHasConsented] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentOptIn, setCurrentOptIn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      checkExistingOptIn();
      if (salesPerson?.cell_phone) {
        setPhoneNumber(formatPhoneNumber(salesPerson.cell_phone));
      }
    }
  }, [isOpen, user, salesPerson]);

  const checkExistingOptIn = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sms_opt_ins')
        .select('*')
        .eq('user_id', user.id)
        .eq('opted_in', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentOptIn(data);
        setPhoneNumber(formatPhoneNumber(data.phone_number));
      }
    } catch (error) {
      console.error('Error checking opt-in status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const cleanPhoneNumber = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = cleanPhoneNumber(value);

    if (cleaned.length <= 10) {
      setPhoneNumber(formatPhoneNumber(cleaned));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasConsented) {
      setNotification({
        type: 'error',
        message: 'You must check the consent box to opt in to SMS messages.'
      });
      return;
    }

    if (!phoneNumber || cleanPhoneNumber(phoneNumber).length !== 10) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid 10-digit phone number.'
      });
      return;
    }

    if (!user) return;

    setIsSubmitting(true);

    try {
      const cleanedPhone = cleanPhoneNumber(phoneNumber);

      const { error } = await supabase
        .from('sms_opt_ins')
        .insert({
          user_id: user.id,
          phone_number: cleanedPhone,
          opted_in: true,
          consent_timestamp: new Date().toISOString()
        });

      if (error) throw error;

      setShowConfirmation(true);
    } catch (error: any) {
      console.error('Error saving SMS opt-in:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to save SMS opt-in preference.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptOut = async () => {
    if (!user || !currentOptIn) return;

    if (!confirm('Are you sure you want to opt out of SMS notifications?')) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('sms_opt_ins')
        .update({
          opted_in: false,
          opt_out_timestamp: new Date().toISOString()
        })
        .eq('id', currentOptIn.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: 'Successfully opted out of SMS notifications.'
      });

      setTimeout(() => {
        onClose();
        setCurrentOptIn(null);
      }, 2000);
    } catch (error: any) {
      console.error('Error opting out:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to opt out of SMS notifications.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">Thank You for Opting In!</h3>
          <p className="text-slate-600 mb-6">
            You will now receive SMS notifications from Evident Title Agency, Inc. You can opt out at any time by replying STOP.
          </p>
          <button
            onClick={() => {
              setShowConfirmation(false);
              setHasConsented(false);
              onClose();
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-white" />
              <h2 className="text-2xl font-bold text-white">SMS Notifications</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-slate-600">Loading...</p>
              </div>
            ) : currentOptIn ? (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-900 mb-1">You're Already Opted In</h3>
                      <p className="text-sm text-green-700">
                        Phone: {formatPhoneNumber(currentOptIn.phone_number)}
                      </p>
                      <p className="text-sm text-green-700">
                        Opted in: {new Date(currentOptIn.consent_timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-3">Current Settings</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    You are currently receiving SMS notifications from Evident Title Agency, Inc. If you wish to stop receiving messages, you can opt out below.
                  </p>
                  <p className="text-sm text-slate-600 mb-4">
                    You can also reply <strong>STOP</strong> to any message to opt out instantly.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleOptOut}
                    disabled={isSubmitting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {isSubmitting ? 'Processing...' : 'Opt Out of SMS'}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Opt In to SMS Notifications</h3>
                  <p className="text-slate-600 mb-4">
                    Stay connected with important updates, announcements, and time-sensitive information from Evident Title Agency, Inc.
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="(555) 555-5555"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-2">What to Expect:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Important company announcements</li>
                        <li>Time-sensitive communications</li>
                        <li>Report reminders and deadlines</li>
                        <li>Message frequency varies (typically 2-10 messages per month)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasConsented}
                      onChange={(e) => setHasConsented(e.target.checked)}
                      className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      required
                    />
                    <div className="text-sm text-slate-700 leading-relaxed">
                      <p className="mb-3">
                        <strong>I agree to receive SMS text messages from Evident Title Agency, Inc.</strong>
                      </p>
                      <p className="mb-2">
                        By checking this box, I consent to receive automated marketing and operational text messages from Evident Title Agency, Inc. at the phone number provided above. Message frequency varies. Message and data rates may apply.
                      </p>
                      <p className="mb-2">
                        Reply <strong>STOP</strong> to opt out at any time. Reply <strong>HELP</strong> for assistance.
                      </p>
                      <p className="mb-2">
                        Consent to receive SMS messages is not required as a condition of any purchase or service.
                      </p>
                      <p>
                        Your information will be handled in accordance with our <a href="https://www.evidenttitle.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">Privacy Policy</a>. For questions, contact your administrator.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!hasConsented || isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Opt-In'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {notification && (
        <Toast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </>
  );
}
