import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useWeb3 } from '../contexts/Web3Context';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import EditModal from './EditModal';
import ConfirmModal from './ConfirmModal';
import Button from './Button';
import { Copy } from 'lucide-react';
import { ethers } from 'ethers';

export default function AdminPanel({ token, onEditSuccess, hideTrigger = false, open, onClose }) {
  const { account, chainId } = useWeb3();
  const [isOwner, setIsOwner] = useState(false);
  const [showEditMarketing, setShowEditMarketing] = useState(false);
  const [newMarketing, setNewMarketing] = useState('');
  const [prepareArgs, setPrepareArgs] = useState(null);
  const [shouldWrite, setShouldWrite] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmDetails, setConfirmDetails] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showBuyFees, setShowBuyFees] = useState(false);
  const [showSellFees, setShowSellFees] = useState(false);
  const [showEditDev, setShowEditDev] = useState(false);
  const [newDev, setNewDev] = useState('');
  const [showLimits, setShowLimits] = useState(false);
  const [limitsValues, setLimitsValues] = useState({ maxTx: '', maxWallet: '' });
  const [showEditSwap, setShowEditSwap] = useState(false);
  const [newSwap, setNewSwap] = useState('');
  const [feeExemptAddress, setFeeExemptAddress] = useState('');
  const [feeExemptStatus, setFeeExemptStatus] = useState(null);
  const [checkingFeeExempt, setCheckingFeeExempt] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const modalVisible = open !== undefined ? open : showAdminModal;
  const [activeTab, setActiveTab] = useState('General');

  useEffect(() => {
    setIsOwner(Boolean(account && token && token.owner && account.toLowerCase() === token.owner.toLowerCase()));
  }, [account, token]);

  const [txSubmitting, setTxSubmitting] = useState(false);

  // Helper: execute pending action using ethers signer directly
  const executePendingAction = async (action) => {
    if (!action || !action.fn) return toast.error('No action to execute');
    if (!window.ethereum) return toast.error('No injected wallet found');
    try {
      setTxSubmitting(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);

      // Estimate gas where possible
      let gasLimit = null;
      try {
        const estimate = await contract.estimateGas[action.fn](...action.args);
        gasLimit = estimate.mul(110).div(100); // +10%
        console.log('[ADMIN] Gas estimate succeeded:', { fn: action.fn, args: action.args, gasLimit: gasLimit.toString() });
      } catch (e) {
        console.warn('[ADMIN] Gas estimate failed:', e?.message || e);
        // Try to simulate the call to capture revert reason or error details
        try {
          const populated = await contract.populateTransaction[action.fn](...action.args);
          // ensure from is set for simulation
          const signerAddress = await signer.getAddress().catch(() => account || undefined);
          const callReq = {
            to: token.address,
            data: populated.data,
            from: signerAddress,
          };
          console.log('[ADMIN] Simulating call to capture revert reason...', callReq);
          const simProvider = provider; // Web3Provider
          const simResult = await simProvider.call(callReq).catch(simErr => {
            console.error('[ADMIN] Simulation error (call):', simErr);
            return null;
          });
          if (simResult) {
            console.log('[ADMIN] Simulation returned data:', simResult);
          }
        } catch (simErr) {
          console.error('[ADMIN] populateTransaction or simulation failed:', simErr);
        }
      }

      console.log('[ADMIN] Sending transaction:', { fn: action.fn, args: action.args, gasLimit: gasLimit ? gasLimit.toString() : undefined });
      toast.info('Sending transaction...');
      const tx = await contract[action.fn](...action.args, gasLimit ? { gasLimit } : {});
      toast.info(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      toast.success('Transaction confirmed');
      if (typeof onEditSuccess === 'function') {
        onEditSuccess();
      }
    } catch (e) {
      console.error('[ADMIN] tx error', e);
      toast.error(e?.message || 'Transaction failed');
    } finally {
      setTxSubmitting(false);
    }
  };

  const onConfirmMarketing = async (value) => {
    if (!value || value.length !== 42) return toast.error('Invalid address');
    // estimate gas and show confirm
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setMarketingWallet(value);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Set marketing wallet to ${value}` });
      setPendingAction({ fn: 'setMarketingWallet', args: [value] });
      setShowConfirm(true);
    } catch (e) {
      // fallback: attempt to send the transaction even if estimate fails
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setMarketingWallet', args: [value] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    } finally {
      setShowEditMarketing(false);
    }
  };

  const onConfirmDev = async (value) => {
    if (!value || value.length !== 42) return toast.error('Invalid address');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setDevWallet(value);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Set dev wallet to ${value}` });
      setPendingAction({ fn: 'setDevWallet', args: [value] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setDevWallet', args: [value] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    } finally {
      setShowEditDev(false);
    }
  };

  const onConfirmBuyFees = async (jsonString) => {
    console.log('[ADMIN] onConfirmBuyFees called with:', jsonString);
    let obj = null;
    try { obj = JSON.parse(jsonString); } catch (e) { return toast.error('Invalid input'); }
    const m = Number(obj.marketing || 0);
    const d = Number(obj.dev || 0);
    const lp = Number(obj.lp || 0);
    // validation
    if (m < 0 || d < 0 || lp < 0) return toast.error('Fees must be >= 0');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setBuyFees(m, d, lp);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Set buy fees to ${m}/${d}/${lp}` });
      setPendingAction({ fn: 'setBuyFees', args: [m, d, lp] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setBuyFees', args: [m, d, lp] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    } finally {
      setShowBuyFees(false);
    }
  };

  const onConfirmSellFees = async (jsonString) => {
    console.log('[ADMIN] onConfirmSellFees called with:', jsonString);
    let obj = null;
    try { obj = JSON.parse(jsonString); } catch (e) { return toast.error('Invalid input'); }
    const m = Number(obj.marketing || 0);
    const d = Number(obj.dev || 0);
    const lp = Number(obj.lp || 0);
    if (m < 0 || d < 0 || lp < 0) return toast.error('Fees must be >= 0');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setSellFees(m, d, lp);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Set sell fees to ${m}/${d}/${lp}` });
      setPendingAction({ fn: 'setSellFees', args: [m, d, lp] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setSellFees', args: [m, d, lp] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    } finally {
      setShowSellFees(false);
    }
  };

  // Validation wrappers to enforce same rules as token creation
  const validateAndConfirmBuyFees = async (jsonString) => {
    let obj = null;
    try { obj = JSON.parse(jsonString); } catch (e) { return toast.error('Invalid input'); }
    const m = Number(obj.marketing || 0);
    const d = Number(obj.dev || 0);
    const lp = Number(obj.lp || 0);
    if ([m, d, lp].some(v => isNaN(v))) return toast.error('Fees must be numbers');
    if (m < 0 || d < 0 || lp < 0) return toast.error('Fees must be >= 0');
    if (m > 30 || d > 30 || lp > 30) return toast.error('Each fee must be <= 30%');
    const total = m + d + lp;
    if (total > 30) return toast.error('Total buy fee must not exceed 30%');
    // enforce combined buy+sell <= 60
    const existingSell = token.sellFees || { marketing: 0, dev: 0, lp: 0 };
    const sellTotal = Number(existingSell.marketing || 0) + Number(existingSell.dev || 0) + Number(existingSell.lp || 0);
    if ((total + sellTotal) > 60) return toast.error('Combined buy+sell fees must not exceed 60%');
    return await onConfirmBuyFees(jsonString);
  };

  const validateAndConfirmSellFees = async (jsonString) => {
    let obj = null;
    try { obj = JSON.parse(jsonString); } catch (e) { return toast.error('Invalid input'); }
    const m = Number(obj.marketing || 0);
    const d = Number(obj.dev || 0);
    const lp = Number(obj.lp || 0);
    if ([m, d, lp].some(v => isNaN(v))) return toast.error('Fees must be numbers');
    if (m < 0 || d < 0 || lp < 0) return toast.error('Fees must be >= 0');
    if (m > 30 || d > 30 || lp > 30) return toast.error('Each fee must be <= 30%');
    const total = m + d + lp;
    if (total > 30) return toast.error('Total sell fee must not exceed 30%');
    // enforce combined buy+sell <= 60
    const existingBuy = token.buyFees || { marketing: 0, dev: 0, lp: 0 };
    const buyTotal = Number(existingBuy.marketing || 0) + Number(existingBuy.dev || 0) + Number(existingBuy.lp || 0);
    if ((total + buyTotal) > 60) return toast.error('Combined buy+sell fees must not exceed 60%');
    return await onConfirmSellFees(jsonString);
  };

  const onConfirmLimits = async (jsonString) => {
    let obj = null;
    try { obj = JSON.parse(jsonString); } catch (e) { return toast.error('Invalid input'); }
    const maxTx = BigInt(obj.maxTx || 0);
    const maxWallet = BigInt(obj.maxWallet || 0);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.updateLimits(maxTx, maxWallet);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Update limits Tx:${maxTx} Wallet:${maxWallet}` });
      setPendingAction({ fn: 'updateLimits', args: [maxTx, maxWallet] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'updateLimits', args: [maxTx, maxWallet] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    } finally {
      setShowLimits(false);
    }
  };

  const onConfirmSwap = async (value) => {
    if (!value) return toast.error('Invalid value');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const parsed = BigInt(value.toString());
      const gas = await contract.estimateGas.setSwapTokensAtAmount(parsed);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Set swap threshold to ${value}` });
      setPendingAction({ fn: 'setSwapTokensAtAmount', args: [parsed] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setSwapTokensAtAmount', args: [BigInt(value.toString())] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    } finally {
      setShowEditSwap(false);
    }
  };

  const checkFeeExempt = async (address) => {
    if (!address) return toast.error('Please enter an address');
    if (address.length !== 42) return toast.error('Invalid address');
    setCheckingFeeExempt(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, provider);
      const isEx = await contract.isFeeExempt(address);
      setFeeExemptStatus(Boolean(isEx));
      toast.info(`Fee exempt: ${isEx}`);
    } catch (e) {
      console.error('[ADMIN] checkFeeExempt error', e);
      toast.error('Failed to check exemption');
    } finally {
      setCheckingFeeExempt(false);
    }
  };

  const toggleFeeExempt = async (address, newVal) => {
    if (!address) return toast.error('Please enter an address');
    if (address.length !== 42) return toast.error('Invalid address');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setFeeExempt(address, newVal);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `${newVal ? 'Set' : 'Unset'} fee exemption for ${address}` });
      setPendingAction({ fn: 'setFeeExempt', args: [address, newVal] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setFeeExempt', args: [address, newVal] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
    }
  };

  const confirmAndSend = async () => {
    if (!pendingAction) return toast.error('No pending action');
    setShowConfirm(false);
    const action = pendingAction;
    setPendingAction(null);
    setConfirmDetails(null);
    // Always send transaction, even if gas estimation failed
    await executePendingAction(action);
  };

  if (!token) return null;

  const summaryLine = (label, value) => (
    <div className="flex items-center justify-between text-sm">
      <div className="text-gray-400">{label}</div>
      <div className="text-white font-mono">{value}</div>
    </div>
  );

  return (
    <div className="mt-4 border-t border-gray-800 pt-3">
      {isOwner ? (
        <div>
          {modalVisible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowAdminModal(false); if (typeof onClose === 'function') onClose(); }} />
              <div className="relative w-full max-w-3xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl p-6 z-10 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold text-white">Manage {token.symbol}</div>
                  <div className="flex items-center gap-2">
                    <button className="text-gray-400 hover:text-white" onClick={() => { setShowAdminModal(false); if (typeof onClose === 'function') onClose(); }}>Close</button>
                  </div>
                </div>

                <div className="mb-3">
                  <nav className="flex gap-2 text-sm">
                    {['General','Fees','Wallets','Limits','Exemptions'].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1 rounded ${activeTab===tab ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>{tab}</button>
                    ))}
                  </nav>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-auto">
                  {activeTab === 'General' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Trading Paused</div>
                        <div className="flex items-center gap-2">
                          <div className={`font-mono ${token.tradingPaused ? 'text-yellow-400' : 'text-green-400'}`}>{token.tradingPaused ? 'Yes' : 'No'}</div>
                          <Button size="sm" variant="outline" onClick={() => {
                            const newVal = !token.tradingPaused;
                            (async () => {
                              try {
                                const provider = new ethers.providers.Web3Provider(window.ethereum);
                                const signer = provider.getSigner();
                                const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
                                const gas = await contract.estimateGas.setTradingPaused(newVal);
                                const feeData = await provider.getFeeData();
                                const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
                                const cost = ethers.utils.formatEther(gas.mul(gasPrice));
                                setConfirmDetails({ gas, cost, label: `Set tradingPaused → ${newVal}` });
                                setPendingAction({ fn: 'setTradingPaused', args: [newVal] });
                                setShowConfirm(true);
                              } catch (e) {
                                try {
                                  await executePendingAction({ fn: 'setTradingPaused', args: [newVal] });
                                } catch (sendErr) {
                                  console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
                                  toast.error(sendErr?.message || 'Transaction failed after estimation error');
                                }
                              }
                            })();
                          }}>Toggle</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Swap Threshold</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">{token.swapTokensAtAmount || '—'}</div>
                          <Button size="sm" variant="outline" onClick={() => { setNewSwap(token.swapTokensAtAmount || ''); setShowEditSwap(true); }}>Edit</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Fees' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Buy Fees (mkt/dev/lp)</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">{token.buyFees ? `${token.buyFees.marketing}/${token.buyFees.dev}/${token.buyFees.lp}` : '—'}</div>
                          <Button size="sm" variant="outline" onClick={() => setShowBuyFees(true)}>Edit</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Sell Fees (mkt/dev/lp)</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">{token.sellFees ? `${token.sellFees.marketing}/${token.sellFees.dev}/${token.sellFees.lp}` : '—'}</div>
                          <Button size="sm" variant="outline" onClick={() => setShowSellFees(true)}>Edit</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Wallets' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Marketing Wallet</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono flex items-center gap-1">{token.marketingWallet?.slice(0,6)}...{token.marketingWallet?.slice(-4)}
                            <button className="text-gray-400 hover:text-cyan-400 focus:outline-none" onClick={() => { navigator.clipboard.writeText(token.marketingWallet); toast.success('Address copied to clipboard!'); }} aria-label="Copy marketing wallet"><Copy size={14} /></button>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setNewMarketing(token.marketingWallet || ''); setShowEditMarketing(true); }}>Edit</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Dev Wallet</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono flex items-center gap-1">{token.devWallet?.slice(0,6)}...{token.devWallet?.slice(-4)}
                            <button className="text-gray-400 hover:text-cyan-400 focus:outline-none" onClick={() => { navigator.clipboard.writeText(token.devWallet); toast.success('Address copied to clipboard!'); }} aria-label="Copy dev wallet"><Copy size={14} /></button>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setNewDev(token.devWallet || ''); setShowEditDev(true); }}>Edit</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Limits' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Limits</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">Tx: {token.maxTransactionAmount || '—'} / Wallet: {token.maxWalletAmount || '—'}</div>
                          <Button size="sm" variant="outline" onClick={() => setShowLimits(true)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => { setPrepareArgs({ fn: 'removeLimits', args: [] }); setShouldWrite(true); }}>Remove</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Exemptions' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white w-60" placeholder="0x..." value={feeExemptAddress} onChange={(e) => { setFeeExemptAddress(e.target.value); setFeeExemptStatus(null); }} />
                        <Button size="sm" variant="outline" onClick={() => checkFeeExempt(feeExemptAddress)} disabled={checkingFeeExempt || !feeExemptAddress}>Check</Button>
                        <Button size="sm" variant="primary" onClick={() => toggleFeeExempt(feeExemptAddress, !(feeExemptStatus === true))} disabled={!feeExemptAddress}>{feeExemptStatus ? 'Unset Exempt' : 'Set Exempt'}</Button>
                      </div>
                      {feeExemptStatus !== null && (<div className="text-xs text-gray-400">Address is {feeExemptStatus ? 'fee-exempt' : 'not fee-exempt'}</div>)}
                    </div>
                  )}
                </div>

                {/* Keep existing edit modals and confirm modal available inside modal context */}
                <EditModal isOpen={showEditMarketing} onClose={() => setShowEditMarketing(false)} title={`Edit Marketing Wallet: ${token.symbol}`} initialValue={newMarketing} onConfirm={onConfirmMarketing} confirmLabel="Set Wallet" />
                <EditModal isOpen={showEditDev} onClose={() => setShowEditDev(false)} title={`Edit Dev Wallet: ${token.symbol}`} initialValue={newDev} onConfirm={onConfirmDev} confirmLabel="Set Wallet" />

                <EditModal isOpen={showBuyFees} onClose={() => setShowBuyFees(false)} title={`Edit Buy Fees: ${token.symbol}`} initialValue={JSON.stringify({ marketing: token.buyFees?.marketing || 0, dev: token.buyFees?.dev || 0, lp: token.buyFees?.lp || 0 })} onConfirm={validateAndConfirmBuyFees} confirmLabel="Set Buy Fees" validate={(value) => {
                  try { const obj = JSON.parse(value || '{}');
                    const m = Number(obj.marketing || 0);
                    const d = Number(obj.dev || 0);
                    const lp = Number(obj.lp || 0);
                    if ([m,d,lp].some(v => isNaN(v))) return { valid: false, message: 'Fees must be numbers' };
                    if (m < 0) return { valid: false, message: 'Marketing fee must be >= 0' };
                    if (d < 0) return { valid: false, message: 'Dev fee must be >= 0' };
                    if (lp < 0) return { valid: false, message: 'LP fee must be >= 0' };
                    if (m > 30) return { valid: false, message: `Marketing fee ${m}% exceeds 30%` };
                    if (d > 30) return { valid: false, message: `Dev fee ${d}% exceeds 30%` };
                    if (lp > 30) return { valid: false, message: `LP fee ${lp}% exceeds 30%` };
                    const total = m + d + lp;
                    if (total > 30) return { valid: false, message: `Total buy fee ${total}% exceeds 30%` };
                    const existingSell = token.sellFees || { marketing:0,dev:0,lp:0 };
                    const sellTotal = Number(existingSell.marketing||0) + Number(existingSell.dev||0) + Number(existingSell.lp||0);
                    if ((total + sellTotal) > 60) return { valid: false, message: `Combined buy+sell ${total+sellTotal}% exceeds 60%` };
                    return { valid: true };
                  } catch (e) { return { valid: false, message: 'Invalid input format' }; }
                }}>
                  {({ value, setValue }) => {
                    let obj = {};
                    try { obj = JSON.parse(value || '{}'); } catch (e) { obj = { marketing: 0, dev: 0, lp: 0 }; }
                    const total = Number(obj.marketing || 0) + Number(obj.dev || 0) + Number(obj.lp || 0);
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs text-gray-400">Marketing Buy Fee (%)</label>
                          <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" type="number" min="0" max="30" value={obj.marketing} onChange={(e)=>{ obj.marketing = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="0-30" />
                          <label className="text-xs text-gray-400">Dev Buy Fee (%)</label>
                          <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" type="number" min="0" max="30" value={obj.dev} onChange={(e)=>{ obj.dev = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="0-30" />
                          <label className="text-xs text-gray-400">LP Buy Fee (%)</label>
                          <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" type="number" min="0" max="30" value={obj.lp} onChange={(e)=>{ obj.lp = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="0-30" />
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Total Buy Fee: {total}% (must not exceed 30%)</div>
                      </div>
                    );
                  }}
                </EditModal>

                <EditModal isOpen={showSellFees} onClose={() => setShowSellFees(false)} title={`Edit Sell Fees: ${token.symbol}`} initialValue={JSON.stringify({ marketing: token.sellFees?.marketing || 0, dev: token.sellFees?.dev || 0, lp: token.sellFees?.lp || 0 })} onConfirm={validateAndConfirmSellFees} confirmLabel="Set Sell Fees" validate={(value) => {
                  try { const obj = JSON.parse(value || '{}');
                    const m = Number(obj.marketing || 0);
                    const d = Number(obj.dev || 0);
                    const lp = Number(obj.lp || 0);
                    if ([m,d,lp].some(v => isNaN(v))) return { valid: false, message: 'Fees must be numbers' };
                    if (m < 0) return { valid: false, message: 'Marketing fee must be >= 0' };
                    if (d < 0) return { valid: false, message: 'Dev fee must be >= 0' };
                    if (lp < 0) return { valid: false, message: 'LP fee must be >= 0' };
                    if (m > 30) return { valid: false, message: `Marketing fee ${m}% exceeds 30%` };
                    if (d > 30) return { valid: false, message: `Dev fee ${d}% exceeds 30%` };
                    if (lp > 30) return { valid: false, message: `LP fee ${lp}% exceeds 30%` };
                    const total = m + d + lp;
                    if (total > 30) return { valid: false, message: `Total sell fee ${total}% exceeds 30%` };
                    const existingBuy = token.buyFees || { marketing:0,dev:0,lp:0 };
                    const buyTotal = Number(existingBuy.marketing||0) + Number(existingBuy.dev||0) + Number(existingBuy.lp||0);
                    if ((total + buyTotal) > 60) return { valid: false, message: `Combined buy+sell ${total+buyTotal}% exceeds 60%` };
                    return { valid: true };
                  } catch (e) { return { valid: false, message: 'Invalid input format' }; }
                }}>
                  {({ value, setValue }) => {
                    let obj = {};
                    try { obj = JSON.parse(value || '{}'); } catch (e) { obj = { marketing: 0, dev: 0, lp: 0 }; }
                    const total = Number(obj.marketing || 0) + Number(obj.dev || 0) + Number(obj.lp || 0);
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs text-gray-400">Marketing Sell Fee (%)</label>
                          <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" type="number" min="0" max="30" value={obj.marketing} onChange={(e)=>{ obj.marketing = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="0-30" />
                          <label className="text-xs text-gray-400">Dev Sell Fee (%)</label>
                          <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" type="number" min="0" max="30" value={obj.dev} onChange={(e)=>{ obj.dev = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="0-30" />
                          <label className="text-xs text-gray-400">LP Sell Fee (%)</label>
                          <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" type="number" min="0" max="30" value={obj.lp} onChange={(e)=>{ obj.lp = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="0-30" />
                        </div>
                        <div className="text-xs text-gray-400 mt-2">Total Sell Fee: {total}% (must not exceed 30%)</div>
                      </div>
                    );
                  }}
                </EditModal>

                <EditModal isOpen={showLimits} onClose={() => setShowLimits(false)} title={`Update Limits: ${token.symbol}`} initialValue={JSON.stringify({ maxTx: token.maxTransactionAmount || 0, maxWallet: token.maxWalletAmount || 0 })} onConfirm={onConfirmLimits} confirmLabel="Update Limits">
                  {({ value, setValue }) => {
                    let obj = {};
                    try { obj = JSON.parse(value || '{}'); } catch (e) { obj = { maxTx: '', maxWallet: '' }; }
                    return (
                      <div className="space-y-2">
                        <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" value={obj.maxTx} onChange={(e)=>{ obj.maxTx = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="Max transaction amount (raw units)" />
                        <input className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white" value={obj.maxWallet} onChange={(e)=>{ obj.maxWallet = e.target.value; setValue(JSON.stringify(obj)); }} placeholder="Max wallet amount (raw units)" />
                        <div className="text-xs text-gray-400">Values are raw token units (not decimals-adjusted). Enforce minimal values in frontend.</div>
                      </div>
                    );
                  }}
                </EditModal>

                <EditModal isOpen={showEditSwap} onClose={() => setShowEditSwap(false)} title={`Set Swap Threshold: ${token.symbol}`} initialValue={newSwap} onConfirm={onConfirmSwap} confirmLabel="Set Threshold" />

                <ConfirmModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={confirmAndSend} details={confirmDetails}><div className="text-sm text-white">{confirmDetails?.label}</div></ConfirmModal>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="text-xs text-gray-500">View-only: connect as owner to see admin controls</div>
      )}
    </div>
  );
}
