import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { getRecord } from 'lightning/uiRecordApi';

import getObjectApiNameFromRecordId from '@salesforce/apex/DynamicApprovalController.getObjectApiNameFromRecordId';
import getApprovalStatusForRecord from '@salesforce/apex/DynamicApprovalController.getApprovalStatusForRecord';
import previewApprovers from '@salesforce/apex/DynamicApprovalController.previewApprovers';
import submitForApprovalApex from '@salesforce/apex/DynamicApprovalController.submitForApproval';

export default class SubmitForApproval extends LightningElement {
    
    // ==================== API PROPERTIES ====================
    
    @api recordId;
    
    // ==================== TRACKED PROPERTIES ====================
    
    @track isLoading = true;
    @track isLoadingPreview = false;
    @track objectApiName = '';
    
    @track availableList = [];
    @track completedList = [];
    @track inProgressList = [];
    @track lockedList = [];
    
    @track selectedConfigId = '';
    @track approverPreviews = [];
    @track comments = '';
    @track availableOptions = [];
    
    // ==================== NON-TRACKED PROPERTIES ====================
    
    _rawAvailableList = [];
    _hasInitialized = false;
    
    // ==================== WIRE ADAPTERS ====================
    
    // Wire to ensure recordId is populated
    @wire(getRecord, { recordId: '$recordId', fields: ['Id'] })
    wiredRecord({ error, data }) {
        if (data) {
            console.log('Record wired successfully, recordId:', this.recordId);
            if (!this._hasInitialized) {
                this._hasInitialized = true;
                this.loadApprovalStatus();
            }
        } else if (error) {
            console.error('Error wiring record:', error);
            // Still try to load if recordId exists
            if (this.recordId && !this._hasInitialized) {
                this._hasInitialized = true;
                this.loadApprovalStatus();
            }
        }
    }
    
    // ==================== GETTERS ====================
    
    get hasAnyProcesses() {
        const hasAvail = this.availableList && this.availableList.length > 0;
        const hasComp = this.completedList && this.completedList.length > 0;
        const hasInProg = this.inProgressList && this.inProgressList.length > 0;
        const hasLock = this.lockedList && this.lockedList.length > 0;
        
        return hasAvail || hasComp || hasInProg || hasLock;
    }
    
    get hasAvailable() {
        return this.availableList && this.availableList.length > 0;
    }
    
    get hasCompleted() {
        return this.completedList && this.completedList.length > 0;
    }
    
    get hasInProgress() {
        return this.inProgressList && this.inProgressList.length > 0;
    }
    
    get hasLocked() {
        return this.lockedList && this.lockedList.length > 0;
    }
    
    get showApproverPreview() {
        if (!this.selectedConfigId) {
            return false;
        }
        if (this.selectedConfigId.length === 0) {
            return false;
        }
        return true;
    }
    
    get hasApproverPreviews() {
        return this.approverPreviews && this.approverPreviews.length > 0;
    }
    
    get isSubmitDisabled() {
        if (this.isLoading) {
            return true;
        }
        if (this.isLoadingPreview) {
            return true;
        }
        if (!this.selectedConfigId) {
            return true;
        }
        if (this.selectedConfigId.length === 0) {
            return true;
        }
        return false;
    }
    
    // ==================== LIFECYCLE ====================
    
    connectedCallback() {
        console.log('SubmitForApproval - connectedCallback');
        console.log('recordId from @api:', this.recordId);
        
        // Try multiple ways to get recordId
        if (!this.recordId) {
            // Method 1: Try to get from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const recordIdFromUrl = urlParams.get('recordId');
            if (recordIdFromUrl) {
                console.log('Found recordId in URL params:', recordIdFromUrl);
                this.recordId = recordIdFromUrl;
            }
            
            // Method 2: Try to get from window.location.pathname
            if (!this.recordId) {
                const pathParts = window.location.pathname.split('/');
                const recordIdFromPath = pathParts.find(part => 
                    part.length === 18 && (part.startsWith('001') || part.startsWith('003') || 
                    part.startsWith('006') || part.startsWith('a0'))
                );
                if (recordIdFromPath) {
                    console.log('Found recordId in URL path:', recordIdFromPath);
                    this.recordId = recordIdFromPath;
                }
            }
        }
        
        // If we have recordId and haven't initialized, load data
        // Otherwise wait for wire adapter
        if (this.recordId && !this._hasInitialized) {
            console.log('Loading approval status from connectedCallback');
            this._hasInitialized = true;
            this.loadApprovalStatus();
        } else if (!this.recordId) {
            console.warn('No recordId available in connectedCallback');
            // Will wait for wire adapter or show error after timeout
            setTimeout(() => {
                if (!this.recordId) {
                    this.showToast('Error', 'Unable to determine record ID. Please close this dialog and try again from the record page.', 'error');
                    this.isLoading = false;
                }
            }, 2000);
        }
    }
    
    // ==================== DATA LOADING METHODS ====================
    
    async loadApprovalStatus() {
        this.isLoading = true;
        
        try {
            console.log('Loading approval status for recordId:', this.recordId);
            
            // Validate recordId
            if (!this.recordId) {
                throw new Error('Record ID is null or undefined');
            }
            
            // Get object API name
            const objectName = await getObjectApiNameFromRecordId({ 
                recordId: this.recordId 
            });
            console.log('Object API Name:', objectName);
            this.objectApiName = objectName;
            
            // Get approval status
            const status = await getApprovalStatusForRecord({ 
                recordId: this.recordId 
            });
            console.log('Approval Status:', status);
            this.processApprovalStatus(status);
            
        } catch (error) {
            console.error('Error in loadApprovalStatus:', error);
            this.showToast('Error', this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    processApprovalStatus(status) {
        const availableArr = [];
        const completedArr = [];
        const inProgressArr = [];
        const lockedArr = [];
        const optionsArr = [];
        
        // Process available
        if (status && status.available) {
            for (let i = 0; i < status.available.length; i++) {
                const item = status.available[i];
                availableArr.push({
                    configId: item.configId,
                    processLabel: item.processLabel,
                    processType: item.processType,
                    numberOfSteps: item.numberOfSteps,
                    statusMessage: item.statusMessage,
                    canResubmit: item.canResubmit,
                    steps: item.steps
                });
            }
        }
        
        // Process completed
        if (status && status.completed) {
            for (let i = 0; i < status.completed.length; i++) {
                const item = status.completed[i];
                completedArr.push({
                    configId: item.configId,
                    processLabel: item.processLabel,
                    statusMessage: item.statusMessage
                });
            }
        }
        
        // Process in progress
        if (status && status.inProgress) {
            for (let i = 0; i < status.inProgress.length; i++) {
                const item = status.inProgress[i];
                inProgressArr.push({
                    configId: item.configId,
                    processLabel: item.processLabel,
                    statusMessage: item.statusMessage
                });
            }
        }
        
        // Process locked
        if (status && status.locked) {
            for (let i = 0; i < status.locked.length; i++) {
                const item = status.locked[i];
                lockedArr.push({
                    configId: item.configId,
                    processLabel: item.processLabel,
                    statusMessage: item.statusMessage
                });
            }
        }
        
        // Build available options for radio group
        for (let i = 0; i < availableArr.length; i++) {
            const item = availableArr[i];
            const processLabel = item.processLabel || '';
            const configId = item.configId || '';
            const description = this.buildDescriptionFromItem(item);
            const optionLabel = processLabel + ' - ' + description;
            
            optionsArr.push({
                label: optionLabel,
                value: configId
            });
        }
        
        // Store raw list for auto-select
        this._rawAvailableList = availableArr;
        
        // Set tracked properties
        this.availableList = availableArr;
        this.completedList = completedArr;
        this.inProgressList = inProgressArr;
        this.lockedList = lockedArr;
        this.availableOptions = optionsArr;
        
        // Auto-select if only one available
        if (availableArr.length === 1) {
            this.selectedConfigId = availableArr[0].configId;
            this.loadApproverPreview();
        }
    }
    
    buildDescriptionFromItem(item) {
        let description = '';
        let stepCount = 0;
        const stepNames = [];
        
        if (item && item.numberOfSteps) {
            stepCount = item.numberOfSteps;
        }
        
        description = stepCount + ' Step(s)';
        
        if (item && item.steps) {
            const steps = item.steps;
            for (let i = 0; i < steps.length; i++) {
                if (steps[i] && steps[i].stepName) {
                    const stepName = steps[i].stepName;
                    if (stepName.length > 0) {
                        stepNames.push(stepName);
                    }
                }
            }
            
            if (stepNames.length > 0) {
                description = description + ': ' + stepNames.join(' > ');
            }
        }
        
        if (item && item.canResubmit) {
            description = description + ' (Resubmit)';
        }
        
        return description;
    }
    
    async loadApproverPreview() {
        if (!this.selectedConfigId) {
            this.approverPreviews = [];
            return;
        }
        
        if (this.selectedConfigId.length === 0) {
            this.approverPreviews = [];
            return;
        }
        
        // Validate recordId
        if (!this.recordId) {
            console.error('Cannot load approver preview: recordId is null');
            return;
        }
        
        this.isLoadingPreview = true;
        
        try {
            console.log('Loading approver preview - recordId:', this.recordId, 'configId:', this.selectedConfigId);
            
            const previews = await previewApprovers({
                recordId: this.recordId,
                configId: this.selectedConfigId
            });
            console.log('Approver previews:', previews);
            this.processApproverPreviews(previews);
        } catch (error) {
            console.error('Error loading approver preview:', error);
            this.approverPreviews = [];
            this.showToast('Warning', 'Could not load approver preview: ' + this.getErrorMessage(error), 'warning');
        } finally {
            this.isLoadingPreview = false;
        }
    }
    
    processApproverPreviews(previews) {
        const previewsArr = [];
        
        if (previews && previews.length > 0) {
            for (let i = 0; i < previews.length; i++) {
                const item = previews[i];
                previewsArr.push({
                    stepNumber: item.stepNumber,
                    stepName: item.stepName || '',
                    fieldPath: item.fieldPath || '',
                    approverId: item.approverId || '',
                    approverName: item.approverName || '',
                    isFound: item.isFound || false,
                    message: item.message || ''
                });
            }
        }
        
        this.approverPreviews = previewsArr;
    }
    
    // ==================== EVENT HANDLERS ====================
    
    handleProcessSelection(event) {
        this.selectedConfigId = event.detail.value;
        this.loadApproverPreview();
    }
    
    handleCommentsChange(event) {
        this.comments = event.target.value;
    }
    
    handleCancel() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }
    
    async handleSubmit() {
        // Validate recordId
        if (!this.recordId) {
            this.showToast('Error', 'Record ID is missing. Please refresh and try again.', 'error');
            return;
        }
        
        // Validate selection
        if (!this.selectedConfigId) {
            this.showToast('Error', 'Please select an approval process', 'error');
            return;
        }
        
        if (this.selectedConfigId.length === 0) {
            this.showToast('Error', 'Please select an approval process', 'error');
            return;
        }
        
        // Validate at least one approver
        const hasApprover = this.checkHasApprover();
        
        if (!hasApprover) {
            this.showToast('Warning', 'No approvers found. At least one approver is required.', 'warning');
            return;
        }
        
        this.isLoading = true;
        
        try {
            console.log('Submitting for approval - recordId:', this.recordId, 'configId:', this.selectedConfigId);
            
            const result = await submitForApprovalApex({
                recordId: this.recordId,
                configId: this.selectedConfigId,
                comments: this.comments || ''
            });
            console.log('Submit result:', result);
            this.handleSubmitResult(result);
        } catch (error) {
            console.error('Error submitting for approval:', error);
            this.showToast('Error', this.getErrorMessage(error), 'error');
            this.isLoading = false;
        }
    }
    
    handleSubmitResult(result) {
        let errorMsg;
        
        if (result && result.success) {
            this.showToast('Success', result.message, 'success');
            this.dispatchEvent(new CloseActionScreenEvent());
            this.refreshPage();
        } else {
            errorMsg = 'Failed to submit for approval';
            if (result && result.message) {
                errorMsg = result.message;
            }
            this.showToast('Error', errorMsg, 'error');
        }
        
        this.isLoading = false;
    }
    
    // ==================== HELPER METHODS ====================
    
    checkHasApprover() {
        if (!this.approverPreviews) {
            return false;
        }
        
        if (this.approverPreviews.length === 0) {
            return false;
        }
        
        for (let i = 0; i < this.approverPreviews.length; i++) {
            const preview = this.approverPreviews[i];
            if (preview && preview.isFound === true) {
                return true;
            }
        }
        
        return false;
    }
    
    refreshPage() {
        // Method 1: Try eval for Aura (in Lightning context)
        try {
            // eslint-disable-next-line no-eval
            eval("$A.get('e.force:refreshView').fire();");
            return;
        } catch (e1) {
            // Continue to next method
        }
        
        // Method 2: Fallback to page reload
        try {
            window.location.href = window.location.href;
        } catch (e2) {
            // Last resort - full reload
            window.location.reload();
        }
    }
    
    showToast(title, message, variant) {
        const toastEvent = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'sticky'
        });
        this.dispatchEvent(toastEvent);
    }
    
    getErrorMessage(error) {
        let message = 'Unknown error occurred';
        
        if (error) {
            if (error.body) {
                if (error.body.message) {
                    message = error.body.message;
                } else if (error.body.pageErrors && error.body.pageErrors.length > 0) {
                    message = error.body.pageErrors[0].message;
                } else if (error.body.fieldErrors) {
                    const fieldErrors = [];
                    Object.keys(error.body.fieldErrors).forEach(field => {
                        error.body.fieldErrors[field].forEach(err => {
                            fieldErrors.push(err.message);
                        });
                    });
                    if (fieldErrors.length > 0) {
                        message = fieldErrors.join(', ');
                    }
                }
            } else if (error.message) {
                message = error.message;
            } else if (typeof error === 'string') {
                message = error;
            }
        }
        
        return message;
    }
}