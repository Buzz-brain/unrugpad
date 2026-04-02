import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useWeb3 } from '../contexts/Web3Context';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import EditModal from './EditModal';
import ConfirmModal from './ConfirmModal';
import Button from './Button';
import Input from './Input';
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
  const [showTaxTab, setShowTaxTab] = useState(false);
  const [newTaxManager, setNewTaxManager] = useState('');
  const [newTaxWallet, setNewTaxWallet] = useState('');
  const [newBuyFee, setNewBuyFee] = useState('');
  const [newSellFee, setNewSellFee] = useState('');
  const [feeExemptAddress, setFeeExemptAddress] = useState('');
  const [feeExemptStatus, setFeeExemptStatus] = useState(null);
  const [checkingFeeExempt, setCheckingFeeExempt] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const modalVisible = open !== undefined ? open : showAdminModal;
  const [activeTab, setActiveTab] = useState('General');

  useEffect(() => {
    setIsOwner(Boolean(account && token && token.owner && account.toLowerCase() === token.owner.toLowerCase()));
  }, [account, token]);

  const [activeAction, setActiveAction] = useState(null); // e.g. 'tradingPaused', 'swap', etc.
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const isGlobalLoading = Boolean(activeAction || confirmSubmitting);
  const [estimatingMarketing, setEstimatingMarketing] = useState(false);
  const [estimatingDev, setEstimatingDev] = useState(false);
  const [estimatingBuyFees, setEstimatingBuyFees] = useState(false);
  const [estimatingSellFees, setEstimatingSellFees] = useState(false);
  const [estimatingSwap, setEstimatingSwap] = useState(false);
  const [estimatingLimits, setEstimatingLimits] = useState(false);

  // Helper: execute pending action using ethers signer directly
  const executePendingAction = async (action) => {
    if (!action || !action.fn) return toast.error('No action to execute');
    if (!window.ethereum) return toast.error('No injected wallet found');
    try {
      setConfirmSubmitting(true);
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
      if (e?.code === 4001 || e?.message?.toLowerCase().includes('user denied') || e?.message?.toLowerCase().includes('cancelled') || e?.message?.toLowerCase().includes('rejected')) {
        toast.error('Transaction cancelled by user');
      } else if (e?.code === -32603 && e?.message?.includes('No active wallet found')) {
        toast.error('No wallet connected. Please connect your wallet and try again.');
      } else if (e?.message?.includes('Extension context invalidated')) {
        toast.error('Wallet extension disconnected. Please refresh the page and reconnect your wallet.');
      } else {
        toast.error(e?.message || 'Transaction failed');
      }
    } finally {
      setConfirmSubmitting(false);
      setActiveAction(null);
    }
  };

  const onConfirmMarketing = async (value) => {
    if (!value || value.length !== 42) return toast.error('Invalid address');
    setActiveAction('marketingWallet');
    setEstimatingMarketing(true);
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
      setShowEditMarketing(false);
    } catch (e) {
      // fallback: attempt to send the transaction even if estimate fails
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setMarketingWallet', args: [value] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowEditMarketing(false);
    } finally {
      setEstimatingMarketing(false);
    }
  };

  const onConfirmDev = async (value) => {
    if (!value || value.length !== 42) return toast.error('Invalid address');
    setActiveAction('devWallet');
    setEstimatingDev(true);
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
      setShowEditDev(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setDevWallet', args: [value] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowEditDev(false);
    } finally {
      setEstimatingDev(false);
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
    setActiveAction('buyFees');
    setEstimatingBuyFees(true);
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
      setShowBuyFees(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setBuyFees', args: [m, d, lp] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowBuyFees(false);
    } finally {
      setEstimatingBuyFees(false);
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
    setActiveAction('sellFees');
    setEstimatingSellFees(true);
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
      setShowSellFees(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setSellFees', args: [m, d, lp] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowSellFees(false);
    } finally {
      setEstimatingSellFees(false);
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
    setActiveAction('limits');
    setEstimatingLimits(true);
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
      setShowLimits(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'updateLimits', args: [maxTx, maxWallet] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowLimits(false);
    } finally {
      setEstimatingLimits(false);
    }
  };

  const onConfirmRemoveLimits = async () => {
    setActiveAction('removeLimits');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.removeLimits();
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: 'Remove transaction and wallet limits' });
      setPendingAction({ fn: 'removeLimits', args: [] });
      setShowConfirm(true);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'removeLimits', args: [] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
    }
  };

  const onConfirmTradingPaused = async (newVal) => {
    setActiveAction('tradingPaused');
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
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setTradingPaused', args: [newVal] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
    }
  };

  const onConfirmSwap = async (value) => {
    if (!value) return toast.error('Invalid value');
    setActiveAction('swap');
    setEstimatingSwap(true);
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
      setShowEditSwap(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setSwapTokensAtAmount', args: [BigInt(value.toString())] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowEditSwap(false);
    } finally {
      setEstimatingSwap(false);
    }
  };

  const onConfirmTaxManager = async (value) => {
    if (!value || value.length !== 42) return toast.error('Invalid address');
    setActiveAction('taxManager');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setTaxManager(value);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Transfer tax manager to ${value}` });
      setPendingAction({ fn: 'setTaxManager', args: [value] });
      setShowConfirm(true);
      setShowTaxTab(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setTaxManager', args: [value] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowTaxTab(false);
    }
  };

  const onConfirmTaxWallet = async (value) => {
    if (!value || value.length !== 42) return toast.error('Invalid address');
    setActiveAction('taxWallet');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      const gas = await contract.estimateGas.setTaxWallet(value);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      setConfirmDetails({ gas, cost, label: `Set tax wallet to ${value}` });
      setPendingAction({ fn: 'setTaxWallet', args: [value] });
      setShowConfirm(true);
      setShowTaxTab(false);
    } catch (e) {
      toast.warn('Could not estimate gas precisely; sending transaction anyway.');
      try {
        await executePendingAction({ fn: 'setTaxWallet', args: [value] });
      } catch (sendErr) {
        console.error('[ADMIN] direct send failed after estimate failure:', sendErr);
        toast.error(sendErr?.message || 'Transaction failed after estimation error');
      }
      setActiveAction(null);
      setShowTaxTab(false);
    }
  };

  const onConfirmReduceTax = async (buy, sell) => {
    const buyVal = Number(buy);
    const sellVal = Number(sell);
    if (isNaN(buyVal) || isNaN(sellVal)) return toast.error('Invalid values');
    if (buyVal < 0 || sellVal < 0) return toast.error('Values must be non-negative');
    if (buyVal > 30 || sellVal > 30) return toast.error('Values must be <= 30');

    setActiveAction('reduceTax');
    // Prefer specialized contract function if exists
    const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, (new ethers.providers.Web3Provider(window.ethereum)).getSigner());
    if (contract.reduceCustomTax) {
      setConfirmDetails({ label: `Reduce tax to buy:${buyVal}% sell:${sellVal}%` });
      setPendingAction({ fn: 'reduceCustomTax', args: [buyVal, sellVal] });
      setShowConfirm(true);
    } else {
      // Fallback to standard fee setters
      setConfirmDetails({ label: `Set buy fees ${buyVal} and sell fees ${sellVal}` });
      setPendingAction({ fn: 'setBuyFees', args: [buyVal, 0, 0] });
      setShowConfirm(true);
      // Note: the user may need to also adjust sell fees separately
    }
    setShowTaxTab(false);
  };

  const onConfirmRenounceOwnership = async () => {
    setActiveAction('renounceOwnership');
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer);
      console.log('[ADMIN] Attempting to estimate gas for renounceOwnership');
      const gas = await contract.estimateGas.renounceOwnership();
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei');
      const cost = ethers.utils.formatEther(gas.mul(gasPrice));
      console.log('[ADMIN] Gas estimate succeeded:', { gas: gas.toString(), cost });
      setConfirmDetails({ gas, cost, label: 'Renounce ownership (tax role remains)' });
      setPendingAction({ fn: 'renounceOwnership', args: [] });
      setShowConfirm(true);
      setShowTaxTab(false);
    } catch (e) {
      console.error('[ADMIN] Gas estimate failed for renounceOwnership:', e);
      // Fallback: allow user to proceed without gas estimate
      console.log('[ADMIN] Proceeding without gas estimate');
      setConfirmDetails({ label: 'Renounce ownership (tax role remains)' });
      setPendingAction({ fn: 'renounceOwnership', args: [] });
      setShowConfirm(true);
      toast.info('Ready to renounce ownership. Please confirm in MetaMask.');
      setActiveAction(null);
      setShowTaxTab(false);
    }
  };

  const checkFeeExempt = async (address) => {
    if (!address) return toast.error('Please enter an address');
    if (address.length !== 42) return toast.error('Invalid address');
    setCheckingFeeExempt(true);
    setActiveAction('checkFeeExempt');
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
      setActiveAction(null);
    }
  };

  const toggleFeeExempt = async (address, newVal) => {
    if (!address) return toast.error('Please enter an address');
    if (address.length !== 42) return toast.error('Invalid address');
    setActiveAction('feeExempt');
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
      setActiveAction(null);
    } finally {
      // no additional state needed here
    }
  };

  const handleConfirmCancel = () => {
    setShowConfirm(false);
    setPendingAction(null);
    setConfirmDetails(null);
    setActiveAction(null);
    setConfirmSubmitting(false);
    setEstimatingMarketing(false);
    setEstimatingDev(false);
    setEstimatingBuyFees(false);
    setEstimatingSellFees(false);
    setEstimatingSwap(false);
    setEstimatingLimits(false);
  };

  const confirmAndSend = async () => {
    if (!pendingAction) return toast.error('No pending action');
    setConfirmSubmitting(true);
    setEstimatingMarketing(false);
    setEstimatingDev(false);
    setEstimatingBuyFees(false);
    setEstimatingSellFees(false);
    setEstimatingSwap(false);
    setEstimatingLimits(false);

    const action = pendingAction;
    setPendingAction(null);

    try {
      await executePendingAction(action);
      setShowConfirm(false); // Close modal only after successful transaction
      setConfirmDetails(null); // Clear details after modal closes
      setActiveAction(null);
    } finally {
      setConfirmSubmitting(false);
    }
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
                    {['General','Fees','Wallets','Tax','Limits','Exemptions'].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1 rounded ${activeTab===tab ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>{tab}</button>
                    ))}
                  </nav>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {activeTab === 'General' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Trading Paused</div>
                        <div className="flex items-center gap-2">
                          <div className={`font-mono ${token.tradingPaused ? 'text-yellow-400' : 'text-green-400'}`}>{token.tradingPaused ? 'Yes' : 'No'}</div>
                          <Button size="sm" variant="outline" loading={activeAction === 'tradingPaused'} disabled={isGlobalLoading && activeAction !== 'tradingPaused'} onClick={() => onConfirmTradingPaused(!token.tradingPaused)}>Toggle</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Swap Threshold</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">{token.swapTokensAtAmount || '—'}</div>
                          <Button size="sm" variant="outline" loading={activeAction === 'swap'} disabled={isGlobalLoading && activeAction !== 'swap'} onClick={() => { setNewSwap(token.swapTokensAtAmount || ''); setShowEditSwap(true); }}>Edit</Button>
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
                          <Button size="sm" variant="outline" loading={activeAction === 'buyFees'} disabled={isGlobalLoading && activeAction !== 'buyFees'} onClick={() => setShowBuyFees(true)}>Edit</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Sell Fees (mkt/dev/lp)</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">{token.sellFees ? `${token.sellFees.marketing}/${token.sellFees.dev}/${token.sellFees.lp}` : '—'}</div>
                          <Button size="sm" variant="outline" loading={activeAction === 'sellFees'} disabled={isGlobalLoading && activeAction !== 'sellFees'} onClick={() => setShowSellFees(true)}>Edit</Button>
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
                          <Button size="sm" variant="outline" loading={activeAction === 'marketingWallet'} disabled={isGlobalLoading && activeAction !== 'marketingWallet'} onClick={() => { setNewMarketing(token.marketingWallet || ''); setShowEditMarketing(true); }}>Edit</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Dev Wallet</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono flex items-center gap-1">{token.devWallet?.slice(0,6)}...{token.devWallet?.slice(-4)}
                            <button className="text-gray-400 hover:text-cyan-400 focus:outline-none" onClick={() => { navigator.clipboard.writeText(token.devWallet); toast.success('Address copied to clipboard!'); }} aria-label="Copy dev wallet"><Copy size={14} /></button>
                          </div>
                          <Button size="sm" variant="outline" loading={activeAction === 'devWallet'} disabled={isGlobalLoading && activeAction !== 'devWallet'} onClick={() => { setNewDev(token.devWallet || ''); setShowEditDev(true); }}>Edit</Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Tax Wallet</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono flex items-center gap-1">{token.taxWallet ? `${token.taxWallet.slice(0,6)}...${token.taxWallet.slice(-4)}` : '—'}
                            {token.taxWallet && <button className="text-gray-400 hover:text-cyan-400 focus:outline-none" onClick={() => { navigator.clipboard.writeText(token.taxWallet); toast.success('Address copied to clipboard!'); }} aria-label="Copy tax wallet"><Copy size={14} /></button>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Tax Manager</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono flex items-center gap-1">{token.taxManager ? `${token.taxManager.slice(0,6)}...${token.taxManager.slice(-4)}` : '—'}
                            {token.taxManager && <button className="text-gray-400 hover:text-cyan-400 focus:outline-none" onClick={() => { navigator.clipboard.writeText(token.taxManager); toast.success('Address copied to clipboard!'); }} aria-label="Copy tax manager"><Copy size={14} /></button>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Tax' && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-400">Tax configuration and owner/tax-manager controls.</div>
                      <div className="flex flex-col gap-2">
                        {!token.ownershipRenounced ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => onConfirmRenounceOwnership()} disabled={!isOwner || token.ownershipRenounced || isGlobalLoading} loading={activeAction === 'renounceOwnership'}>
                              Renounce Ownership
                            </Button>
                            <div className="text-xs text-gray-500 mt-2">
                              After renouncing ownership, you can transfer tax management and reduce taxes.
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-green-400 mb-2">
                            ✓ Ownership renounced - tax management controls available
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Input
                            label="New Tax Manager"
                            value={newTaxManager}
                            onChange={(e) => setNewTaxManager(e.target.value)}
                            placeholder="0x..."
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            loading={activeAction === 'taxManager'}
                            disabled={!token.ownershipRenounced || (isGlobalLoading && activeAction !== 'taxManager')}
                            onClick={() => onConfirmTaxManager(newTaxManager)}
                          >
                            Transfer Tax Manager
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Input
                            label="New Tax Wallet"
                            value={newTaxWallet}
                            onChange={(e) => setNewTaxWallet(e.target.value)}
                            placeholder="0x..."
                          />
                          <Button size="sm" variant="primary" loading={activeAction === 'taxWallet'} disabled={isGlobalLoading && activeAction !== 'taxWallet'} onClick={() => onConfirmTaxWallet(newTaxWallet)}>
                            Set Tax Wallet
                          </Button>
                        </div>

                        {token.ownershipRenounced && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input
                                label="Reduce Buy Tax (percent)"
                                value={newBuyFee}
                                onChange={(e) => setNewBuyFee(e.target.value)}
                                placeholder="0-30"
                              />
                              <Input
                                label="Reduce Sell Tax (percent)"
                                value={newSellFee}
                                onChange={(e) => setNewSellFee(e.target.value)}
                                placeholder="0-30"
                              />
                            </div>
                            <Button size="sm" variant="outline" loading={activeAction === 'reduceTax'} disabled={isGlobalLoading && activeAction !== 'reduceTax'} onClick={() => onConfirmReduceTax(newBuyFee, newSellFee)}>
                              Reduce Tax
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'Limits' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">Limits</div>
                        <div className="flex items-center gap-2">
                          <div className="text-white font-mono">Tx: {token.maxTransactionAmount || '—'} / Wallet: {token.maxWalletAmount || '—'}</div>
                          <Button size="sm" variant="outline" loading={isGlobalLoading} disabled={isGlobalLoading} onClick={() => setShowLimits(true)}>Edit</Button>
                          <Button size="sm" variant="outline" loading={activeAction === 'removeLimits'} disabled={isGlobalLoading && activeAction !== 'removeLimits'} onClick={() => onConfirmRemoveLimits()}>Remove</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Exemptions' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white w-60" placeholder="0x..." value={feeExemptAddress} onChange={(e) => { setFeeExemptAddress(e.target.value); setFeeExemptStatus(null); }} />
                        <Button size="sm" variant="outline" loading={checkingFeeExempt || activeAction === 'checkFeeExempt'} onClick={() => checkFeeExempt(feeExemptAddress)} disabled={checkingFeeExempt || !feeExemptAddress || isGlobalLoading}>Check</Button>
                        <Button size="sm" variant="primary" loading={activeAction === 'feeExempt'} onClick={() => toggleFeeExempt(feeExemptAddress, !(feeExemptStatus === true))} disabled={!feeExemptAddress || isGlobalLoading}>{feeExemptStatus ? 'Unset Exempt' : 'Set Exempt'}</Button>
                      </div>
                      {feeExemptStatus !== null && (<div className="text-xs text-gray-400">Address is {feeExemptStatus ? 'fee-exempt' : 'not fee-exempt'}</div>)}
                    </div>
                  )}
                </div>

                {/* Keep existing edit modals and confirm modal available inside modal context */}
                <EditModal isOpen={showEditMarketing} onClose={() => setShowEditMarketing(false)} title={`Edit Marketing Wallet: ${token.symbol}`} initialValue={newMarketing} onConfirm={onConfirmMarketing} confirmLabel="Set Wallet" loading={estimatingMarketing || confirmSubmitting} />
                <EditModal isOpen={showEditDev} onClose={() => setShowEditDev(false)} title={`Edit Dev Wallet: ${token.symbol}`} initialValue={newDev} onConfirm={onConfirmDev} confirmLabel="Set Wallet" loading={estimatingDev || confirmSubmitting} />

                <EditModal isOpen={showBuyFees} onClose={() => setShowBuyFees(false)} title={`Edit Buy Fees: ${token.symbol}`} loading={estimatingBuyFees || confirmSubmitting} initialValue={JSON.stringify({ marketing: token.buyFees?.marketing || 0, dev: token.buyFees?.dev || 0, lp: token.buyFees?.lp || 0 })} onConfirm={validateAndConfirmBuyFees} confirmLabel="Set Buy Fees" validate={(value) => {
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

                <EditModal isOpen={showSellFees} onClose={() => setShowSellFees(false)} title={`Edit Sell Fees: ${token.symbol}`} loading={estimatingSellFees || confirmSubmitting} initialValue={JSON.stringify({ marketing: token.sellFees?.marketing || 0, dev: token.sellFees?.dev || 0, lp: token.sellFees?.lp || 0 })} onConfirm={validateAndConfirmSellFees} confirmLabel="Set Sell Fees" validate={(value) => {
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

                <EditModal isOpen={showLimits} onClose={() => setShowLimits(false)} title={`Update Limits: ${token.symbol}`} loading={estimatingLimits || confirmSubmitting} initialValue={JSON.stringify({ maxTx: token.maxTransactionAmount || 0, maxWallet: token.maxWalletAmount || 0 })} onConfirm={onConfirmLimits} confirmLabel="Update Limits">
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

                <EditModal isOpen={showEditSwap} onClose={() => setShowEditSwap(false)} title={`Set Swap Threshold: ${token.symbol}`} initialValue={newSwap} onConfirm={onConfirmSwap} confirmLabel="Set Threshold" loading={estimatingSwap || confirmSubmitting} />

                <ConfirmModal isOpen={showConfirm} onClose={handleConfirmCancel} onConfirm={confirmAndSend} details={confirmDetails} loading={confirmSubmitting}><div className="text-sm text-white">{confirmDetails?.label}</div></ConfirmModal>
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
