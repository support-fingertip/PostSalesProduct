import { LightningElement, api, track } from 'lwc';
import getVisualforcePages from '@salesforce/apex/EmailFieldPickerController.getVisualforcePages';

export default class EmailAttachmentRow extends LightningElement {
    @api index;
    @api objectApiName;
    @api attachmentData = {};
    @api canDelete = false; // Changed from true to false
    
    @track localData = {};
    @track vfPageOptions = [];
    @track isLoadingVfPages = false;
    
    attachmentTypeOptions = [
        { label:  'Visualforce Page (PDF)', value: 'VFPage' },
        { label: 'Static Document', value: 'StaticDocument' }
    ];
    
    connectedCallback() {
        this.localData = { ...this. attachmentData };
        this.loadVfPages();
    }
    
    async loadVfPages() {
        try {
            this. isLoadingVfPages = true;
            const pages = await getVisualforcePages();
            this.vfPageOptions = pages.map(page => ({
                label: page.label,
                value: page.value
            }));
        } catch (error) {
            console.error('Error loading VF pages:', error);
        } finally {
            this. isLoadingVfPages = false;
        }
    }
    
    // Handlers
    handleNameChange(event) {
        this.localData.name = event.target.value;
        this.notifyChange();
    }
    
    handleTypeChange(event) {
        this.localData.type = event.detail. value;
        // Clear type-specific fields
        this.localData.vfPageName = '';
        this.localData.documentId = '';
        this.notifyChange();
    }
    
    handleVfPageChange(event) {
        this.localData.vfPageName = event.detail.value;
        this.notifyChange();
    }
    
    handleVfPageParamChange(event) {
        this.localData.vfPageParam = event.target.value;
        this.notifyChange();
    }
    
    handleDocumentIdChange(event) {
        this.localData. documentId = event.target.value;
        this.notifyChange();
    }
    
    handleFileNamePatternChange(event) {
        this. localData.fileNamePattern = event.target.value;
        this.notifyChange();
    }
    
    handleDefaultCheckedChange(event) {
        this. localData.isDefaultChecked = event. target.checked;
        this.notifyChange();
    }
    
    handleRequiredChange(event) {
        this. localData.isRequired = event.target. checked;
        // If required, must be default checked
        if (event.target.checked) {
            this. localData.isDefaultChecked = true;
        }
        this.notifyChange();
    }
    
    handleDelete() {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { index: this.index }
        }));
    }
    
    handleInsertMergeField(event) {
        const mergeField = event.detail.mergeField;
        const currentPattern = this.localData.fileNamePattern || '';
        this.localData.fileNamePattern = currentPattern + mergeField;
        this.notifyChange();
    }
    
    notifyChange() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                index: this.index,
                data: { ...this.localData }
            }
        }));
    }
    
    // Getters
    get showVfPageFields() {
        return this.localData.type === 'VFPage';
    }
    
    get showDocumentFields() {
        return this.localData.type === 'StaticDocument';
    }
    
    get rowNumber() {
        return this.index + 1;
    }
    
    get attachmentType() {
        return this.localData.type || 'VFPage';
    }
    
    get attachmentName() {
        return this.localData.name || '';
    }
    
    get vfPageName() {
        return this. localData.vfPageName || '';
    }
    
    get vfPageParam() {
        return this. localData.vfPageParam || 'id';
    }
    
    get documentId() {
        return this.localData.documentId || '';
    }
    
    get fileNamePattern() {
        return this.localData.fileNamePattern || '';
    }
    
    get isDefaultChecked() {
        return this. localData.isDefaultChecked || false;
    }
    
    get isRequired() {
        return this.localData. isRequired || false;
    }
    
    // Getter to determine if delete button should show
    get showDeleteButton() {
        // If canDelete is not explicitly set to false, show delete button
        return this.canDelete !== false;
    }
}