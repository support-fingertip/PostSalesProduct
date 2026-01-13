import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

// Import Apex Methods
import getBookingSummary from '@salesforce/apex/FinancialTransactionController.getBookingSummary';
import getOpenDemands from '@salesforce/apex/FinancialTransactionController.getOpenDemands';
import getAvailableCredits from '@salesforce/apex/FinancialTransactionController.getAvailableCredits';
import getAvailableAdvances from '@salesforce/apex/FinancialTransactionController.getAvailableAdvances';
import getTransactionHistory from '@salesforce/apex/FinancialTransactionController.getTransactionHistory';
import createReceipt from '@salesforce/apex/FinancialTransactionController.createReceipt';
import createCreditNote from '@salesforce/apex/FinancialTransactionController.createCreditNote';
import createDebitNote from '@salesforce/apex/FinancialTransactionController.createDebitNote';
import createRefund from '@salesforce/apex/FinancialTransactionController.createRefund';
import getPaymentModeOptions from '@salesforce/apex/FinancialTransactionController.getPaymentModeOptions';
import getBankOptions from '@salesforce/apex/FinancialTransactionController.getBankOptions';
import getCreditTypeOptions from '@salesforce/apex/FinancialTransactionController.getCreditTypeOptions';
import getDebitTypeOptions from '@salesforce/apex/FinancialTransactionController.getDebitTypeOptions';
import getRefundReasonOptions from '@salesforce/apex/FinancialTransactionController.getRefundReasonOptions';

export default class FinancialTransactionManager extends NavigationMixin(LightningElement) {
    @api recordId;
    
    // State Management
    @track isLoading = false;
    @track showSummary = true;
    @track activeTab = 'receipt';
    
    // Booking Summary
    @track bookingSummary = {
        bookingName: '',
        projectName: '',
        unitNumber: '',
        originalAgreementValue: 0,
        totalCreditNotes: 0,
        totalDebitNotes: 0,
        netAgreementValue: 0,
        totalDemandRaised: 0,
        totalReceiptAmount: 0,
        advancePaymentAvailable: 0,
        outstandingDemandAmount: 0,
        futureDemandBalance: 0,
        currentPayableBalance: 0
    };
    
    // Lists
    @track openDemands = [];
    @track availableCredits = [];
    @track availableAdvances = [];
    @track transactionHistory = [];
    
    // Receipt Fields
    @track receiptDate = new Date().toISOString().split('T')[0];
    @track amountReceived = 0;
    @track tdsAmount = 0;
    @track paymentMode = '';
    @track paymentFrom = '';
    @track bankName = '';
    @track transactionNumber = '';
    @track chequeDate;
    @track remarks = '';
    @track useAdvances = true;
    @track useCredits = true;
    
    // Credit Note Fields
    @track creditDate = new Date().toISOString().split('T')[0];
    @track creditAmount = 0;
    @track creditType = '';
    @track creditReason = '';
    @track creditDescription = '';
    @track applyTo = '';
    @track autoApply = true;
    
    // Debit Note Fields
    @track debitDate = new Date().toISOString().split('T')[0];
    @track debitAmount = 0;
    @track debitType = '';
    @track debitReason = '';
    @track debitDescription = '';
    @track chargeAgainst = '';
    @track autoCreateDemand = true;
    
    // Refund Fields
    @track refundDate = new Date().toISOString().split('T')[0];
    @track refundAmount = 0;
    @track refundReason = '';
    @track refundMode = '';
    @track refundBankName = '';
    @track refundReference = '';
    @track refundDescription = '';
    
    // Picklist Options
    @track paymentModeOptions = [];
    @track bankOptions = [];
    @track creditTypeOptions = [];
    @track debitTypeOptions = [];
    @track refundReasonOptions = [];
    
    paymentFromOptions = [
        { label: 'Choose... ', value: '' },
        { label:  'Customer', value: 'Customer' },
        { label: 'Bank', value: 'Bank' },
        { label:  'Other', value: 'Other' }
    ];
    
    applyToOptions = [
        { label:  'Choose...', value: '' },
        { label: 'Specific Schedule', value: 'Specific Schedule' },
        { label: 'Next Demand', value: 'Next Demand' },
        { label:  'General', value: 'General' }
    ];
    
    chargeAgainstOptions = [
        { label: 'Choose...', value: '' },
        { label: 'Specific Schedule', value: 'Specific Schedule' },
        { label: 'Booking', value: 'Booking' },
        { label: 'Ad-hoc', value: 'Ad-hoc' }
    ];
    
    refundModeOptions = [
        { label: 'Choose...', value: '' },
        { label: 'Cheque', value: 'Cheque' },
        { label: 'NEFT', value: 'NEFT' },
        { label: 'RTGS', value: 'RTGS' },
        { label:  'Cash', value: 'Cash' }
    ];
    
    // Lifecycle Hooks
    connectedCallback() {
        this. loadData();
    }
    
    async loadData() {
        this.isLoading = true;
        try {
            await Promise.all([
                this.loadBookingSummary(),
                this.loadOpenDemands(),
                this.loadAvailableCredits(),
                this.loadAvailableAdvances(),
                this.loadPicklistOptions(),
                this.loadTransactionHistory()
            ]);
        } catch (error) {
            this. showToast('Error', 'Failed to load data:  ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async loadBookingSummary() {
        try {
            const result = await getBookingSummary({ bookingId: this. recordId });
            if (result) {
                this. bookingSummary = result;
            }
        } catch (error) {
            console.error('Error loading booking summary:', error);
        }
    }
    
    async loadOpenDemands() {
        try {
            this.openDemands = await getOpenDemands({ bookingId: this.recordId }) || [];
        } catch (error) {
            console.error('Error loading demands:', error);
        }
    }
    
    async loadAvailableCredits() {
        try {
            this. availableCredits = await getAvailableCredits({ bookingId: this.recordId }) || [];
        } catch (error) {
            console.error('Error loading credits:', error);
        }
    }
    
    async loadAvailableAdvances() {
        try {
            this.availableAdvances = await getAvailableAdvances({ bookingId: this. recordId }) || [];
        } catch (error) {
            console.error('Error loading advances:', error);
        }
    }
    
    async loadTransactionHistory() {
        try {
            const result = await getTransactionHistory({ 
                bookingId: this.recordId, 
                transactionType: this.activeTab 
            });
            this.transactionHistory = this.formatTransactionHistory(result || []);
        } catch (error) {
            console.error('Error loading transaction history:', error);
            this.transactionHistory = [];
        }
    }
    
    formatTransactionHistory(transactions) {
        return transactions.map(txn => {
            const iconMap = {
                'receipt': 'utility: money',
                'credit': 'utility: back',
                'debit': 'utility:forward',
                'refund': 'utility: undo'
            };
            
            const iconClassMap = {
                'receipt': 'history-icon receipt',
                'credit': 'history-icon credit',
                'debit': 'history-icon debit',
                'refund': 'history-icon refund'
            };
            
            const statusClassMap = {
                'Approved': 'status-badge approved',
                'Pending': 'status-badge pending',
                'Rejected': 'status-badge rejected',
                'Draft': 'status-badge draft'
            };
            
            return {
                ... txn,
                icon: iconMap[this.activeTab] || 'utility:record',
                iconClass: iconClassMap[this.activeTab] || 'history-icon',
                statusClass: statusClassMap[txn. status] || 'status-badge',
                formattedAmount: this.formatCurrency(txn. amount),
                formattedDate: this.formatDate(txn.transactionDate)
            };
        });
    }
    
    async loadPicklistOptions() {
        try {
            const [paymentModes, banks, creditTypes, debitTypes, refundReasons] = await Promise.all([
                getPaymentModeOptions(),
                getBankOptions(),
                getCreditTypeOptions(),
                getDebitTypeOptions(),
                getRefundReasonOptions()
            ]);
            
            this.paymentModeOptions = [{ label: 'Choose...', value: '' }, ...paymentModes];
            this.bankOptions = [{ label: 'Choose...', value: '' }, ...banks];
            this.creditTypeOptions = [{ label: 'Choose...', value: '' }, ...creditTypes];
            this.debitTypeOptions = [{ label: 'Choose...', value: '' }, ...debitTypes];
            this.refundReasonOptions = [{ label: 'Choose... ', value: '' }, ...refundReasons];
        } catch (error) {
            console.error('Error loading picklist options:', error);
        }
    }
    
    // ==================== COMPUTED PROPERTIES ====================
    
    // Tab State
    get isReceiptTab() {
        return this.activeTab === 'receipt';
    }
    
    get isCreditTab() {
        return this. activeTab === 'credit';
    }
    
    get isDebitTab() {
        return this.activeTab === 'debit';
    }
    
    get isRefundTab() {
        return this.activeTab === 'refund';
    }
    
    // Summary Toggle
    get summaryToggleIcon() {
        return this.showSummary ? 'utility:chevronup' : 'utility:chevrondown';
    }
    
    get summaryToggleText() {
        return this.showSummary ? 'Hide Summary' : 'Show Summary';
    }
    
    // Transaction Type Button Classes
    get receiptButtonClass() {
        return `selector-btn ${this.activeTab === 'receipt' ? 'active receipt' : ''}`;
    }
    
    get creditButtonClass() {
        return `selector-btn ${this.activeTab === 'credit' ? 'active credit' : ''}`;
    }
    
    get debitButtonClass() {
        return `selector-btn ${this.activeTab === 'debit' ? 'active debit' :  ''}`;
    }
    
    get refundButtonClass() {
        return `selector-btn ${this.activeTab === 'refund' ? 'active refund' : ''}`;
    }
    
    // Active Transaction Details
    get activeTransactionIcon() {
        const icons = {
            'receipt': 'utility:money',
            'credit': 'utility:back',
            'debit':  'utility:forward',
            'refund': 'utility:undo'
        };
        return icons[this.activeTab];
    }
    
    get activeTransactionTitle() {
        const titles = {
            'receipt': 'Receipt',
            'credit': 'Credit Note',
            'debit': 'Debit Note',
            'refund':  'Refund'
        };
        return titles[this.activeTab];
    }
    
    get activeTransactionTitleLower() {
        return this.activeTransactionTitle.toLowerCase();
    }
    
    get activeTransactionBadge() {
        const badges = {
            'receipt': 'Payment In',
            'credit':  'Reduces Dues',
            'debit': 'Adds Charges',
            'refund': 'Payment Out'
        };
        return badges[this.activeTab];
    }
    
    get activeTransactionInfo() {
        const info = {
            'receipt': 'Record customer payments.  Available credits and advances will be utilized automatically.  Any excess payment creates an advance for future use.',
            'credit': 'Credit notes reduce what the customer owes. Use for discounts, price revisions, interest waivers, or goodwill gestures.',
            'debit': 'Debit notes add charges to what the customer owes. Use for late payment interest, modification charges, legal fees, or penalties.',
            'refund': 'Process refunds from available advances or excess payments. Ensure sufficient balance before processing.'
        };
        return info[this. activeTab];
    }
    
    get infoAlertClass() {
        return `info-alert ${this. activeTab}`;
    }
    
    get primaryButtonClass() {
        return `btn btn-primary ${this. activeTab}`;
    }
    
    get submitButtonLabel() {
        const labels = {
            'receipt': 'Create Receipt',
            'credit': 'Create Credit Note',
            'debit': 'Create Debit Note',
            'refund': 'Process Refund'
        };
        return labels[this.activeTab];
    }
    
    // List Checks
    get hasAvailableCredits() {
        return this.availableCredits && this.availableCredits.length > 0;
    }
    
    get hasAvailableAdvances() {
        return this.availableAdvances && this. availableAdvances. length > 0;
    }
    
    get hasAvailableCreditsOrAdvances() {
        return this.hasAvailableCredits || this.hasAvailableAdvances;
    }
    
    get hasOpenDemands() {
        return this.openDemands && this.openDemands.length > 0;
    }
    
    get hasTransactionHistory() {
        return this.transactionHistory && this.transactionHistory.length > 0;
    }
    
    get openDemandsPreview() {
        return this.openDemands. slice(0, 5).map(demand => ({
            ...demand,
            formattedPending: this.formatCurrency(demand. pendingAmount),
            formattedDueDate: this. formatDate(demand. dueDate)
        }));
    }
    
    // ==================== FORMATTED VALUES ====================
    
    get formattedOriginalValue() {
        return this.formatCurrency(this.bookingSummary.originalAgreementValue);
    }
    
    get formattedCreditNotes() {
        return this.formatCurrency(this.bookingSummary.totalCreditNotes);
    }
    
    get formattedDebitNotes() {
        return this.formatCurrency(this.bookingSummary.totalDebitNotes);
    }
    
    get formattedNetAgreement() {
        return this.formatCurrency(this.bookingSummary.netAgreementValue);
    }
    
    get formattedTotalDemanded() {
        return this.formatCurrency(this.bookingSummary.totalDemandRaised);
    }
    
    get formattedTotalReceived() {
        return this.formatCurrency(this.bookingSummary.totalReceiptAmount);
    }
    
    get formattedAdvanceAvailable() {
        return this.formatCurrency(this.bookingSummary.advancePaymentAvailable);
    }
    
    get formattedPendingDemands() {
        return this.formatCurrency(this.bookingSummary.outstandingDemandAmount);
    }
    
    get formattedFutureMilestones() {
        return this.formatCurrency(this. bookingSummary. futureDemandBalance);
    }
    
    get formattedCurrentBalance() {
        const balance = this.bookingSummary.currentPayableBalance || 0;
        const absBalance = Math.abs(balance);
        const formatted = this.formatCurrency(absBalance);
        return balance < 0 ? `${formatted} ` : formatted;
    }
    
    get formattedCurrentBalancePreview() {
        return this.formatCurrency(Math.abs(this. bookingSummary. currentPayableBalance || 0));
    }
    
    get balanceValueClass() {
        return this.bookingSummary.currentPayableBalance > 0 
            ? 'balance-value negative' 
            :  'balance-value positive';
    }
    
    get formattedMaxRefund() {
        const maxRefund = this. bookingSummary. advancePaymentAvailable || 0;
        return this.formatCurrency(maxRefund);
    }
    
    // ==================== PREVIEW CALCULATIONS ====================
    
    get currentAmount() {
        switch (this.activeTab) {
            case 'receipt':  return this.amountReceived || 0;
            case 'credit':  return this.creditAmount || 0;
            case 'debit': return this. debitAmount || 0;
            case 'refund':  return this.refundAmount || 0;
            default: return 0;
        }
    }
    
    get formattedAfterTransaction() {
        let currentBalance = this.bookingSummary.currentPayableBalance || 0;
        let newBalance = currentBalance;
        
        switch (this.activeTab) {
            case 'receipt': 
                newBalance = currentBalance - this.currentAmount;
                break;
            case 'credit':
                newBalance = currentBalance - this.currentAmount;
                break;
            case 'debit': 
                newBalance = currentBalance + this.currentAmount;
                break;
            case 'refund': 
                // Refund doesn't affect balance directly, affects advance
                newBalance = currentBalance;
                break;
        }
        
        const absBalance = Math.abs(newBalance);
        const formatted = this.formatCurrency(absBalance);
        return newBalance < 0 ? `${formatted} ` : formatted;
    }
    
    get afterTransactionClass() {
        let currentBalance = this. bookingSummary. currentPayableBalance || 0;
        let newBalance = currentBalance - this.currentAmount;
        
        if (this.activeTab === 'debit') {
            newBalance = currentBalance + this.currentAmount;
        }
        
        return newBalance <= 0 ? 'comparison-value positive' : 'comparison-value negative';
    }
    
    get formattedAmountToApply() {
        return this.formatCurrency(this.amountReceived || 0);
    }
    
    get hasCreditsToUse() {
        return this.useCredits && this.hasAvailableCredits;
    }
    
    get formattedCreditsToUse() {
        const total = this.availableCredits. reduce((sum, c) => sum + (c.amount || 0), 0);
        return this. formatCurrency(total);
    }
    
    get hasAdvancesToUse() {
        return this.useAdvances && this.hasAvailableAdvances;
    }
    
    get formattedAdvancesToUse() {
        const total = this. availableAdvances. reduce((sum, a) => sum + (a.amount || 0), 0);
        return this. formatCurrency(total);
    }
    
    get willCreateAdvance() {
        const totalPayment = this.amountReceived || 0;
        const totalDue = this.bookingSummary.outstandingDemandAmount || 0;
        return totalPayment > totalDue;
    }
    
    get formattedNewAdvance() {
        const totalPayment = this. amountReceived || 0;
        const totalDue = this.bookingSummary.outstandingDemandAmount || 0;
        const newAdvance = Math.max(0, totalPayment - totalDue);
        return this.formatCurrency(newAdvance);
    }
    
    get formattedCreditImpact() {
        return this.formatCurrency(this.creditAmount || 0);
    }
    
    get formattedNewNetAgreement() {
        const currentNet = this.bookingSummary.netAgreementValue || 0;
        const newNet = currentNet - (this.creditAmount || 0);
        return this.formatCurrency(newNet);
    }
    
    get formattedDebitImpact() {
        return this.formatCurrency(this.debitAmount || 0);
    }
    
    get formattedNewNetAgreementDebit() {
        const currentNet = this.bookingSummary.netAgreementValue || 0;
        const newNet = currentNet + (this.debitAmount || 0);
        return this.formatCurrency(newNet);
    }
    
    get formattedRefundImpact() {
        return this.formatCurrency(this.refundAmount || 0);
    }
    
    get formattedRemainingAdvance() {
        const currentAdvance = this.bookingSummary.advancePaymentAvailable || 0;
        const remaining = Math.max(0, currentAdvance - (this.refundAmount || 0));
        return this.formatCurrency(remaining);
    }
    
    get demandAllocationPreview() {
        let remainingAmount = this.amountReceived || 0;
        
        return this.openDemands.slice(0, 5).map(demand => {
            const pending = demand.pendingAmount || 0;
            const allocated = Math.min(remainingAmount, pending);
            remainingAmount = Math.max(0, remainingAmount - allocated);
            
            const percentage = pending > 0 ?  (allocated / pending) * 100 :  0;
            
            return {
                ...demand,
                formattedPending: this.formatCurrency(pending),
                formattedAllocated: this. formatCurrency(allocated),
                progressStyle: `width: ${percentage}%`
            };
        });
    }
    
    // ==================== EVENT HANDLERS ====================
    
    toggleSummary() {
        this.showSummary = ! this.showSummary;
    }
    
    handleTransactionTypeChange(event) {
        const newType = event.currentTarget.dataset.type;
        if (newType !== this.activeTab) {
            this. activeTab = newType;
            this. resetForm();
            this.loadTransactionHistory();
        }
    }
    
    resetForm() {
        // Reset all form fields to defaults
        const today = new Date().toISOString().split('T')[0];
        
        // Receipt fields
        this. receiptDate = today;
        this. amountReceived = 0;
        this.paymentMode = '';
        this.transactionNumber = '';
        this.bankName = '';
        this.paymentFrom = '';
        this.remarks = '';
        
        // Credit fields
        this.creditDate = today;
        this.creditAmount = 0;
        this.creditType = '';
        this.applyTo = '';
        this.creditDescription = '';
        this.autoApply = true;
        
        // Debit fields
        this. debitDate = today;
        this. debitAmount = 0;
        this.debitType = '';
        this. chargeAgainst = '';
        this. debitDescription = '';
        this.autoCreateDemand = true;
        
        // Refund fields
        this.refundDate = today;
        this.refundAmount = 0;
        this. refundReason = '';
        this. refundMode = '';
        this.refundBankName = '';
        this. refundReference = '';
        this.refundDescription = '';
    }
    
    // Receipt Handlers
    handleReceiptDateChange(event) {
        this.receiptDate = event.target.value;
    }
    
    handleAmountChange(event) {
        this.amountReceived = parseFloat(event.target.value) || 0;
    }
    
    handlePaymentModeChange(event) {
        this.paymentMode = event.detail.value;
    }
    
    handleTransactionNumberChange(event) {
        this.transactionNumber = event.target.value;
    }
    
    handleBankChange(event) {
        this.bankName = event.detail.value;
    }
    
    handlePaymentFromChange(event) {
        this.paymentFrom = event.detail.value;
    }
    
    handleRemarksChange(event) {
        this.remarks = event.target.value;
    }
    
    // Credit Note Handlers
    handleCreditDateChange(event) {
        this.creditDate = event.target.value;
    }
    
    handleCreditAmountChange(event) {
        this.creditAmount = parseFloat(event.target.value) || 0;
    }
    
    handleCreditTypeChange(event) {
        this. creditType = event. detail.value;
    }
    
    handleCreditDescriptionChange(event) {
        this. creditDescription = event. target.value;
    }
    
    handleApplyToChange(event) {
        this.applyTo = event. detail.value;
    }
    
    handleAutoApplyChange(event) {
        this.autoApply = event. target.checked;
    }
    
    // Debit Note Handlers
    handleDebitDateChange(event) {
        this.debitDate = event.target.value;
    }
    
    handleDebitAmountChange(event) {
        this.debitAmount = parseFloat(event.target.value) || 0;
    }
    
    handleDebitTypeChange(event) {
        this.debitType = event. detail.value;
    }
    
    handleDebitDescriptionChange(event) {
        this.debitDescription = event.target. value;
    }
    
    handleChargeAgainstChange(event) {
        this.chargeAgainst = event.detail.value;
    }
    
    handleAutoCreateDemandChange(event) {
                this.autoCreateDemand = event.target.checked;
    }
    
    // Refund Handlers
    handleRefundDateChange(event) {
        this.refundDate = event.target.value;
    }
    
    handleRefundAmountChange(event) {
        this.refundAmount = parseFloat(event.target.value) || 0;
    }
    
    handleRefundReasonChange(event) {
        this. refundReason = event.detail.value;
    }
    
    handleRefundModeChange(event) {
        this.refundMode = event. detail.value;
    }
    
    handleRefundBankChange(event) {
        this.refundBankName = event.target.value;
    }
    
    handleRefundReferenceChange(event) {
        this. refundReference = event.target.value;
    }
    
    handleRefundDescriptionChange(event) {
        this.refundDescription = event.target.value;
    }
    
    // Submit Handler
    handleSubmit() {
        switch (this.activeTab) {
            case 'receipt':
                this.handleCreateReceipt();
                break;
            case 'credit': 
                this.handleCreateCreditNote();
                break;
            case 'debit': 
                this.handleCreateDebitNote();
                break;
            case 'refund':
                this.handleCreateRefund();
                break;
        }
    }
    
    async handleCreateReceipt() {
        if (!this.validateReceiptForm()) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            const receiptData = {
                bookingId: this.recordId,
                receiptDate: this. receiptDate,
                amountReceived: this.amountReceived,
                tdsAmount: this.tdsAmount || 0,
                paymentMode: this.paymentMode,
                paymentFrom: this. paymentFrom,
                bankName: this.bankName,
                transactionNumber: this. transactionNumber,
                chequeDate: this.chequeDate,
                remarks: this.remarks,
                useAdvances: this.useAdvances,
                useCredits: this.useCredits
            };
            
            const result = await createReceipt({ receiptData:  JSON.stringify(receiptData) });
            
            if (result.success) {
                this.showToast('Success', result.message || 'Receipt created successfully', 'success');
                this.navigateToRecord(result.receiptId);
            } else {
                this.showToast('Error', result. message || 'Failed to create receipt', 'error');
            }
        } catch (error) {
            this.showToast('Error', 'Failed to create receipt: ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async handleCreateCreditNote() {
        if (!this.validateCreditNoteForm()) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            const creditNoteData = {
                bookingId: this.recordId,
                creditDate: this.creditDate,
                creditAmount: this.creditAmount,
                creditType: this.creditType,
                creditReason: this.creditReason,
                description: this.creditDescription,
                applyTo: this. applyTo,
                autoApply:  this.autoApply,
                priority: 5
            };
            
            const creditNoteId = await createCreditNote({ 
                creditNoteData: JSON.stringify(creditNoteData) 
            });
            
            this.showToast('Success', 'Credit Note created successfully', 'success');
            this.navigateToRecord(creditNoteId);
        } catch (error) {
            this.showToast('Error', 'Failed to create credit note: ' + this.getErrorMessage(error), 'error');
        } finally {
            this. isLoading = false;
        }
    }
    
    async handleCreateDebitNote() {
        if (!this. validateDebitNoteForm()) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            const debitNoteData = {
                bookingId: this.recordId,
                debitDate:  this.debitDate,
                debitAmount: this.debitAmount,
                debitType: this.debitType,
                debitReason: this.debitReason,
                description: this. debitDescription,
                chargeAgainst:  this.chargeAgainst,
                autoCreateDemand: this.autoCreateDemand
            };
            
            const debitNoteId = await createDebitNote({ 
                debitNoteData: JSON. stringify(debitNoteData) 
            });
            
            this.showToast('Success', 'Debit Note created successfully', 'success');
            this.navigateToRecord(debitNoteId);
        } catch (error) {
            this.showToast('Error', 'Failed to create debit note: ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async handleCreateRefund() {
        if (!this.validateRefundForm()) {
            return;
        }
        
        this. isLoading = true;
        
        try {
            const refundData = {
                bookingId: this.recordId,
                refundDate: this.refundDate,
                refundAmount: this.refundAmount,
                refundReason: this.refundReason,
                refundMode:  this.refundMode,
                bankName: this.refundBankName,
                transactionReference: this.refundReference,
                description: this.refundDescription
            };
            
            const refundId = await createRefund({ 
                refundData:  JSON.stringify(refundData) 
            });
            
            this.showToast('Success', 'Refund processed successfully', 'success');
            this.navigateToRecord(refundId);
        } catch (error) {
            this.showToast('Error', 'Failed to process refund:  ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    handleCancel() {
        this.navigateToRecord(this.recordId);
    }
    
    handleHistoryItemClick(event) {
        const recordId = event.currentTarget.dataset.id;
        if (recordId) {
            this.navigateToRecord(recordId);
        }
    }
    
    handleViewAllHistory() {
        // Navigate to list view or related list
        this[NavigationMixin.Navigate]({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: 'Booking__c',
                relationshipApiName: this.getRelationshipName(),
                actionName: 'view'
            }
        });
    }
    
    getRelationshipName() {
        const relationshipMap = {
            'receipt': 'Receipts__r',
            'credit': 'Credit_Notes__r',
            'debit': 'Debit_Notes__r',
            'refund': 'Refunds__r'
        };
        return relationshipMap[this.activeTab] || 'Receipts__r';
    }
    
    // ==================== VALIDATION METHODS ====================
    
    validateReceiptForm() {
        const errors = [];
        
        if (!this. receiptDate) {
            errors.push('Receipt date is required');
        }
        if (!this.amountReceived || this.amountReceived <= 0) {
            errors.push('Please enter a valid amount greater than zero');
        }
        if (!this.paymentMode) {
            errors.push('Please select a payment mode');
        }
        if (!this.transactionNumber) {
            errors.push('Transaction number is required');
        }
        if (!this.bankName) {
            errors.push('Please select a bank');
        }
        if (!this.paymentFrom) {
            errors.push('Please select payment source');
        }
        
        if (errors.length > 0) {
            this.showToast('Validation Error', errors. join('.  '), 'error');
            return false;
        }
        return true;
    }
    
    validateCreditNoteForm() {
        const errors = [];
        
        if (!this.creditDate) {
            errors.push('Credit date is required');
        }
        if (!this. creditAmount || this. creditAmount <= 0) {
            errors.push('Please enter a valid credit amount greater than zero');
        }
        if (! this.creditType) {
            errors. push('Please select a credit type');
        }
        if (! this.applyTo) {
            errors.push('Please select where to apply this credit');
        }
        
        if (errors.length > 0) {
            this.showToast('Validation Error', errors.join('. '), 'error');
            return false;
        }
        return true;
    }
    
    validateDebitNoteForm() {
        const errors = [];
        
        if (! this.debitDate) {
            errors.push('Debit date is required');
        }
        if (!this.debitAmount || this. debitAmount <= 0) {
            errors.push('Please enter a valid debit amount greater than zero');
        }
        if (!this.debitType) {
            errors.push('Please select a debit type');
        }
        if (!this.chargeAgainst) {
            errors.push('Please select what to charge against');
        }
        
        if (errors. length > 0) {
            this. showToast('Validation Error', errors. join('. '), 'error');
            return false;
        }
        return true;
    }
    
    validateRefundForm() {
        const errors = [];
        const maxRefund = this.bookingSummary.advancePaymentAvailable || 0;
        
        if (!this.refundDate) {
            errors. push('Refund date is required');
        }
        if (!this.refundAmount || this.refundAmount <= 0) {
            errors.push('Please enter a valid refund amount greater than zero');
        }
        if (this.refundAmount > maxRefund) {
            errors. push(`Refund amount cannot exceed available advance of ${this.formatCurrency(maxRefund)}`);
        }
        if (!this.refundReason) {
            errors.push('Please select a refund reason');
        }
        if (!this.refundMode) {
            errors.push('Please select a refund mode');
        }
        
        if (errors.length > 0) {
            this.showToast('Validation Error', errors.join('.  '), 'error');
            return false;
        }
        return true;
    }
    
    // ==================== UTILITY METHODS ====================
    
    formatCurrency(value) {
        const numValue = parseFloat(value) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits:  0,
            maximumFractionDigits: 0
        }).format(numValue).replace('₹', '₹ ');
    }
    
    formatDate(dateValue) {
        if (!dateValue) return '';
        const date = new Date(dateValue);
        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month:  'short',
            year: 'numeric'
        }).format(date);
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant:  variant,
            mode: 'dismissable'
        }));
    }
    
    navigateToRecord(recordId) {
        this[NavigationMixin. Navigate]({
            type: 'standard__recordPage',
            attributes:  {
                recordId: recordId,
                actionName: 'view'
            }
        });
    }
    
    getErrorMessage(error) {
        if (! error) return 'An unknown error occurred';
        if (typeof error === 'string') return error;
        if (error. body) {
            if (error.body. message) return error.body.message;
            if (error. body.fieldErrors) {
                const fieldErrors = Object.values(error.body. fieldErrors).flat();
                return fieldErrors.map(e => e.message).join(', ');
            }
            if (error.body. pageErrors) {
                return error.body.pageErrors.map(e => e.message).join(', ');
            }
        }
        if (error.message) return error.message;
        return JSON.stringify(error);
    }
}