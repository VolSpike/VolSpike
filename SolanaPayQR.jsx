import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PublicKey } from '@solana/web3.js';

/**
 * Solana Pay QR Code Component
 * Compatible with Phantom, Solflare, and other Solana wallets
 */
const SolanaPayQR = () => {
  const [paymentData, setPaymentData] = useState({
    recipient: '',
    amount: '',
    splToken: '',
    label: '',
    message: '',
    reference: ''
  });
  const [solanaPayURL, setSolanaPayURL] = useState('');
  const [error, setError] = useState('');

  // Common token addresses
  const TOKENS = {
    SOL: '',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  };

  /**
   * Validate Solana address
   */
  const isValidSolanaAddress = (address) => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Generate Solana Pay URL
   */
  const generateSolanaPayURL = () => {
    setError('');

    // Validate recipient
    if (!paymentData.recipient) {
      setError('Recipient address is required');
      return;
    }

    if (!isValidSolanaAddress(paymentData.recipient)) {
      setError('Invalid recipient address');
      return;
    }

    // Start building URL
    let url = `solana:${paymentData.recipient}`;
    const params = new URLSearchParams();

    // Add amount if provided
    if (paymentData.amount && parseFloat(paymentData.amount) > 0) {
      params.append('amount', paymentData.amount);
    }

    // Add SPL token if provided
    if (paymentData.splToken) {
      if (!isValidSolanaAddress(paymentData.splToken)) {
        setError('Invalid SPL token mint address');
        return;
      }
      params.append('spl-token', paymentData.splToken);
    }

    // Add label
    if (paymentData.label) {
      params.append('label', paymentData.label);
    }

    // Add message/memo
    if (paymentData.message) {
      params.append('message', paymentData.message);
    }

    // Add reference
    if (paymentData.reference) {
      if (!isValidSolanaAddress(paymentData.reference)) {
        setError('Invalid reference address');
        return;
      }
      params.append('reference', paymentData.reference);
    }

    // Construct final URL
    const queryString = params.toString();
    if (queryString) {
      url += '?' + queryString;
    }

    setSolanaPayURL(url);
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Generate URL when inputs change
  useEffect(() => {
    if (paymentData.recipient) {
      generateSolanaPayURL();
    }
  }, [paymentData]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Solana Pay QR Generator</h1>
      
      <div style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Recipient Address *</label>
          <input
            type="text"
            name="recipient"
            value={paymentData.recipient}
            onChange={handleInputChange}
            placeholder="e.g., 7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Amount (Optional)</label>
          <input
            type="number"
            name="amount"
            value={paymentData.amount}
            onChange={handleInputChange}
            placeholder="e.g., 1.5"
            step="0.000000001"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Token</label>
          <select
            name="splToken"
            value={paymentData.splToken}
            onChange={handleInputChange}
            style={styles.input}
          >
            <option value="">SOL (Native)</option>
            <option value={TOKENS.USDC}>USDC</option>
            <option value={TOKENS.USDT}>USDT</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Custom SPL Token (Optional)</label>
          <input
            type="text"
            name="splToken"
            value={paymentData.splToken}
            onChange={handleInputChange}
            placeholder="Enter SPL token mint address"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Label (Optional)</label>
          <input
            type="text"
            name="label"
            value={paymentData.label}
            onChange={handleInputChange}
            placeholder="e.g., Store Purchase"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Message/Memo (Optional)</label>
          <input
            type="text"
            name="message"
            value={paymentData.message}
            onChange={handleInputChange}
            placeholder="e.g., Order #12345"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Reference (Optional)</label>
          <input
            type="text"
            name="reference"
            value={paymentData.reference}
            onChange={handleInputChange}
            placeholder="Unique reference key for tracking"
            style={styles.input}
          />
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {solanaPayURL && !error && (
        <div style={styles.qrContainer}>
          <div style={styles.qrWrapper}>
            <QRCodeSVG
              value={solanaPayURL}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          
          <div style={styles.urlDisplay}>
            <strong>Solana Pay URL:</strong>
            <div style={styles.url}>{solanaPayURL}</div>
          </div>

          <button
            onClick={() => navigator.clipboard.writeText(solanaPayURL)}
            style={styles.button}
          >
            📋 Copy URL
          </button>
        </div>
      )}

      <div style={styles.infoBox}>
        <h3>📱 Compatible Wallets:</h3>
        <ul>
          <li>Phantom</li>
          <li>Solflare</li>
          <li>Backpack</li>
          <li>Glow</li>
          <li>Any Solana Pay compatible wallet</li>
        </ul>
        
        <h3>🔗 URL Format:</h3>
        <code style={styles.code}>
          solana:&lt;recipient&gt;?amount=&lt;amount&gt;&spl-token=&lt;mint&gt;&label=&lt;label&gt;&message=&lt;message&gt;&reference=&lt;reference&gt;
        </code>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  title: {
    color: '#14F195',
    textAlign: 'center',
    marginBottom: '30px'
  },
  form: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: '600',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  button: {
    background: 'linear-gradient(135deg, #14F195, #9945FF)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    marginTop: '10px'
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  urlDisplay: {
    backgroundColor: '#f4f4f4',
    padding: '15px',
    borderRadius: '6px',
    borderLeft: '4px solid #14F195',
    marginBottom: '10px'
  },
  url: {
    wordBreak: 'break-all',
    fontFamily: 'monospace',
    fontSize: '12px',
    marginTop: '10px'
  },
  error: {
    backgroundColor: '#ffebee',
    borderLeft: '4px solid #f44336',
    padding: '15px',
    borderRadius: '4px',
    color: '#c62828',
    marginBottom: '20px'
  },
  infoBox: {
    backgroundColor: '#e8f5e9',
    borderLeft: '4px solid #4caf50',
    padding: '20px',
    borderRadius: '8px'
  },
  code: {
    backgroundColor: '#f5f5f5',
    padding: '10px',
    borderRadius: '4px',
    display: 'block',
    marginTop: '10px',
    fontSize: '12px',
    wordBreak: 'break-all'
  }
};

export default SolanaPayQR;
