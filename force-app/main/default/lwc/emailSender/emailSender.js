import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord } from 'lightning/uiRecordApi';

// Apex Methods
import getObjectApiName from '@salesforce/apex/EmailSenderController.getObjectApiName';
import getTemplatesForObject from '@salesforce/apex/EmailTemplateConfigController.getTemplatesForObject';
import prepareEmailFromTemplate from '@salesforce/apex/EmailSenderController.prepareEmailFromTemplate';
import prepareBlankEmail from '@salesforce/apex/EmailSenderController.prepareBlankEmail';
import getOrgWideEmailAddresses from '@salesforce/apex/EmailFieldPickerController.getOrgWideEmailAddresses';
import getRelatedFiles from '@salesforce/apex/EmailSenderController.getRelatedFiles';
import sendEmail from '@salesforce/apex/EmailSenderController.sendEmail';

export default class EmailSender extends LightningElement {
    // ============ PUBLIC PROPERTIES ============
    @api recordId;
    @api objectApiName; // Can be passed or auto-detected
    @api buttonLabel = 'Send Email';
    @api buttonVariant = 'brand';
    @api buttonIconName = 'utility:email';
    
    // ============ TRACKED PROPERTIES ============
    
    // Loading States
    @track isLoading = false;
    @track isSending = false;
    
    // Modal States
    @track showModal = false;
    @track showPreviewModal = false;
    
    // Data
    @track templates = [];
    @track orgWideEmails = [];
    @track relatedFiles = [];
    
    // Selected Template
    @track selectedTemplateId = '';
    @track isCustomEmail = false;
    
    // Email Data
    @track fromAddressId = '';
    @track fromAddressLabel = '';
    @track replyTo = '';
    @track toRecipients = [];
    @track ccRecipients = [];
    @track bccRecipients = [];
    @track subject = '';
    @track body = '';
    @track attachments = [];
    @track uploadedFiles = [];
    
    // Options
    @track allowAdditionalRecipients = true;
    @track allowFileUpload = true;
    
    // Private
    _objectApiName;
    _initialized = false;
    
    // ============ LIFECYCLE ============
    
    connectedCallback() {
        this. initializeComponent();
    }
    
    async initializeComponent() {
        try {
            this. isLoading = true;
            
            // Get object API name if not provided
            if (!this.objectApiName && this.recordId) {
                this._objectApiName = await getObjectApiName({ recordId: this. recordId });
            } else {
                this._objectApiName = this. objectApiName;
            }
            
            // Load org-wide emails
            await this. loadOrgWideEmails();
            
            this._initialized = true;
            
        } catch (error) {
            this.showToast('Error', this. reduceErrors(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async loadOrgWideEmails() {
        try {
            const emails = await getOrgWideEmailAddresses();
            this.orgWideEmails = [
                { label: '-- Default (My Email) --', value: '' },
                ...emails.map(e => ({
                    label:  e.label,
                    value: e.value
                }))
            ];
        } catch (error) {
            console.error('Error loading org-wide emails:', error);
        }
    }
    
    // ============ MODAL HANDLERS ============
    
    async handleOpenModal() {
        try {
            this. isLoading = true;
            this.showModal = true;
            
            // Load templates for this object
            await this.loadTemplates();
            
            // Load related files
            await this.loadRelatedFiles();
            
            // If there's a default template, select it
            if (this.templates.length > 0) {
                const defaultTemplate = this. templates.find(t => t.isDefault);
                if (defaultTemplate) {
                    this. selectedTemplateId = defaultTemplate.id;
                    await this.loadTemplateData(defaultTemplate.id);
                }
            }
            
        } catch (error) {
            this. showToast('Error', this.reduceErrors(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    handleCloseModal() {
        this.showModal = false;
        this.resetForm();
    }
    
    async loadTemplates() {
        try {
            const templates = await getTemplatesForObject({ 
                objectApiName: this._objectApiName 
            });
            
            this.templates = templates. map(t => ({
                ... t,
                label: t.isDefault ? `${t.name} (Default)` : t.name,
                value: t.id
            }));
            
        } catch (error) {
            console. error('Error loading templates:', error);
            this.templates = [];
        }
    }
    
    async loadRelatedFiles() {
        try {
            this.relatedFiles = await getRelatedFiles({ recordId: this.recordId });
        } catch (error) {
            console.error('Error loading related files:', error);
            this.relatedFiles = [];
        }
    }
    
    // ============ TEMPLATE SELECTION ============
    
    async handleTemplateChange(event) {
        const templateId = event.detail.value;
        this.selectedTemplateId = templateId;
        
        if (templateId === 'custom') {
            this.isCustomEmail = true;
            await this.loadBlankEmail();
        } else if (templateId) {
            this. isCustomEmail = false;
            await this.loadTemplateData(templateId);
        }
    }
    
    async loadTemplateData(templateId) {
        try {
            this.isLoading = true;
            
            const data = await prepareEmailFromTemplate({
                templateId: templateId,
                recordId: this.recordId
            });
            
            this.mapPreparedData(data);
            
        } catch (error) {
            this.showToast('Error', 'Failed to load template:  ' + this.reduceErrors(error), 'error');
        } finally {
            this. isLoading = false;
        }
    }
    
    async loadBlankEmail() {
        try {
            this.isLoading = true;
            
            const data = await prepareBlankEmail({
                recordId: this.recordId,
                objectApiName: this._objectApiName
            });
            
            this. mapPreparedData(data);
            
        } catch (error) {
            this.showToast('Error', 'Failed to prepare email: ' + this. reduceErrors(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    mapPreparedData(data) {
        // From Address
        this.fromAddressId = data.fromAddressId || '';
        this.fromAddressLabel = data.fromAddressLabel || '';
        this.replyTo = data. replyTo || '';
        
        // Recipients
        this.toRecipients = this.mapRecipients(data.toRecipients);
        this.ccRecipients = this.mapRecipients(data.ccRecipients);
        this.bccRecipients = this.mapRecipients(data.bccRecipients);
        
        // Content
        this.subject = data.subject || '';
        this. body = data.body || '';
        
        // Attachments
        this.attachments = (data.attachments || []).map(att => ({
            ... att,
            isSelected: att.isSelected !== false
        }));
        
        // Options
        this.allowAdditionalRecipients = data.allowAdditionalRecipients !== false;
        this.allowFileUpload = data. allowFileUpload !== false;
        // Reset uploaded files
        this.uploadedFiles = [];
    }
    
    mapRecipients(recipients) {
        if (!recipients) return [];
        return recipients.map((r, index) => ({
            ...r,
            id: r.id || `rec_${index}`,
            key: r.id || `rec_${index}`
        }));
    }
    
    // ============ EMAIL CONTENT HANDLERS ============
    
    handleFromAddressChange(event) {
        this.fromAddressId = event.detail. value;
        const selected = this.orgWideEmails.find(e => e. value === this.fromAddressId);
        this.fromAddressLabel = selected ? selected. label : '';
    }
    
    handleReplyToChange(event) {
        this.replyTo = event.target.value;
    }
    
    handleSubjectChange(event) {
        this. subject = event.target.value;
    }
    
    handleBodyChange(event) {
        this.body = event. target.value;
    }
    
    // ============ RECIPIENT HANDLERS ============
    
    handleRemoveToRecipient(event) {
        const id = event.currentTarget.dataset.id;
        this.toRecipients = this.toRecipients.filter(r => r. id !== id);
    }
    
    handleRemoveCcRecipient(event) {
        const id = event.currentTarget.dataset.id;
        this. ccRecipients = this.ccRecipients.filter(r => r.id !== id);
    }
    
    handleRemoveBccRecipient(event) {
        const id = event.currentTarget.dataset.id;
        this.bccRecipients = this.bccRecipients.filter(r => r.id !== id);
    }
    
    handleAddToRecipient() {
        const newEmail = this.template.querySelector('[data-id="new-to-email"]');
        if (newEmail && newEmail.value && this.isValidEmail(newEmail. value)) {
            this.toRecipients = [
                ...this. toRecipients,
                {
                    id: 'new_to_' + Date.now(),
                    email: newEmail.value,
                    label: newEmail.value,
                    isEditable: true,
                    isRequired: false,
                    isValid: true
                }
            ];
            newEmail.value = '';
        } else {
            this.showToast('Error', 'Please enter a valid email address', 'error');
        }
    }
    
    handleAddCcRecipient() {
        const newEmail = this.template.querySelector('[data-id="new-cc-email"]');
        if (newEmail && newEmail.value && this.isValidEmail(newEmail.value)) {
            this. ccRecipients = [
                ...this.ccRecipients,
                {
                    id: 'new_cc_' + Date.now(),
                    email: newEmail.value,
                    label: newEmail.value,
                    isEditable: true,
                    isRequired: false,
                    isValid: true
                }
            ];
            newEmail.value = '';
        } else {
            this.showToast('Error', 'Please enter a valid email address', 'error');
        }
    }
    
    handleAddBccRecipient() {
        const newEmail = this.template.querySelector('[data-id="new-bcc-email"]');
        if (newEmail && newEmail. value && this.isValidEmail(newEmail.value)) {
            this.bccRecipients = [
                ...this. bccRecipients,
                {
                    id: 'new_bcc_' + Date. now(),
                    email: newEmail. value,
                    label: newEmail. value,
                    isEditable: true,
                    isRequired: false,
                    isValid:  true
                }
            ];
            newEmail.value = '';
        } else {
            this.showToast('Error', 'Please enter a valid email address', 'error');
        }
    }
    
    // ============ ATTACHMENT HANDLERS ============
    
    handleAttachmentToggle(event) {
        const id = event.currentTarget. dataset.id;
        const isChecked = event.target.checked;
        
        this.attachments = this.attachments.map(att => {
            if (att. id === id) {
                return { ...att, isSelected: isChecked };
            }
            return att;
        });
    }
    
    handleFileUpload(event) {
        const uploadedFiles = event. detail.files;
        
        this.uploadedFiles = [
            ...this. uploadedFiles,
            ...uploadedFiles.map(file => ({
                documentId: file. documentId,
                name: file.name
            }))
        ];
        
        this.showToast('Success', `${uploadedFiles.length} file(s) uploaded`, 'success');
    }
    
    handleRemoveUploadedFile(event) {
        const docId = event.currentTarget.dataset.id;
        this. uploadedFiles = this.uploadedFiles. filter(f => f.documentId !== docId);
    }
    
    // ============ PREVIEW ============
    
    handlePreview() {
        if (!this.validateEmail()) {
            return;
        }
        this.showPreviewModal = true;
    }
    
    handleClosePreview() {
        this.showPreviewModal = false;
    }
    
    handleBackToEdit() {
        this.showPreviewModal = false;
    }
    
    // ============ SEND EMAIL ============
    
    async handleSend() {
        if (!this.validateEmail()) {
            return;
        }
        
        try {
            this. isSending = true;
            
            const emailData = this.buildEmailData();
            console.log(JSON.stringify(emailData));
            const result = await sendEmail({ 
                emailDataJson: JSON.stringify(emailData) 
            });
            
            if (result.success) {
                this.showToast('Success', result.message || 'Email sent successfully! ', 'success');
                this.showPreviewModal = false;
                this. handleCloseModal();
            } else {
                this.showToast('Error', result. message || 'Failed to send email', 'error');
            }
            
        } catch (error) {
            this. showToast('Error', 'Failed to send email: ' + this. reduceErrors(error), 'error');
        } finally {
            this.isSending = false;
        }
    }
    
    validateEmail() {
        // Check To addresses
        const validToAddresses = this. toRecipients. filter(r => r.email && r.isValid !== false);
        if (validToAddresses.length === 0) {
            this.showToast('Validation Error', 'At least one valid TO recipient is required', 'error');
            return false;
        }
        
        // Check Subject
        if (!this.subject || ! this.subject.trim()) {
            this.showToast('Validation Error', 'Subject is required', 'error');
            return false;
        }
        
        // Check Body
        if (!this. body || !this. body.trim()) {
            this.showToast('Validation Error', 'Email body is required', 'error');
            return false;
        }
        
        return true;
    }
    
    buildEmailData() {
        return {
            templateId: this.isCustomEmail ? null : this.selectedTemplateId,
            recordId: this.recordId,
            objectApiName: this._objectApiName,
            toAddresses: this. toRecipients
                .filter(r => r.email && r.isValid !== false)
                .map(r => r.email),
            ccAddresses: this.ccRecipients
                .filter(r => r.email && r.isValid !== false)
                .map(r => r.email),
            bccAddresses: this.bccRecipients
                .filter(r => r.email && r.isValid !== false)
                .map(r => r. email),
            fromAddressId: this.fromAddressId,
            replyTo: this. replyTo,
            subject: this. subject,
            body: this.body,
            attachments:  this.attachments
                .filter(att => att.isSelected)
                .map(att => ({
                    id: att.id,
                    name:  att.name,
                    fileName: att.fileName,
                    type: att.type,
                    vfPageName: att.VFPageName,
                    vfPageParam: att.VFParamName,
                    documentId: att.documentId,
                    isSelected: att.isSelected
                })),
            uploadedFileIds: this.uploadedFiles.map(f => f. documentId)
        };
    }
    
    resetForm() {
        this.selectedTemplateId = '';
        this.isCustomEmail = false;
        this.fromAddressId = '';
        this.fromAddressLabel = '';
        this.replyTo = '';
        this.toRecipients = [];
        this.ccRecipients = [];
        this.bccRecipients = [];
        this. subject = '';
        this.body = '';
        this.attachments = [];
        this.uploadedFiles = [];
    }
    
    // ============ UTILITIES ============
    
    isValidEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    showToast(title, message, variant) {
        this. dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    
    reduceErrors(errors) {
        if (!Array.isArray(errors)) errors = [errors];
        return errors
            .filter(e => !!e)
            .map(e => e.body?. message || e.message || JSON.stringify(e))
            .join(', ');
    }
    
    // ============ GETTERS ============
    
    get templateOptions() {
        const options = this.templates.map(t => ({
            label: t.label,
            value: t.value
        }));
        
        // Add custom email option
        options.push({
            label: '✏️ Custom Email (Blank)',
            value:  'custom'
        });
        
        return options;
    }
    
    get hasTemplates() {
        return this.templates.length > 0;
    }
    
    get hasToRecipients() {
        return this. toRecipients. length > 0;
    }
    
    get hasCcRecipients() {
        return this.ccRecipients.length > 0;
    }
    
    get hasBccRecipients() {
        return this.bccRecipients.length > 0;
    }
    
    get hasAttachments() {
        return this.attachments.length > 0;
    }
    
    get hasUploadedFiles() {
        return this.uploadedFiles. length > 0;
    }
    
    get selectedAttachmentCount() {
        return this.attachments. filter(a => a.isSelected).length;
    }
    
    get previewEmailData() {
        return {
            fromAddressLabel: this.fromAddressLabel || 'Default (My Email)',
            toAddresses: this. toRecipients. filter(r => r. email).map(r => r.email),
            ccAddresses: this.ccRecipients.filter(r => r.email).map(r => r. email),
            bccAddresses: this.bccRecipients.filter(r => r.email).map(r => r.email),
            subject: this.subject,
            body:  this.body,
            attachments: this.attachments. filter(a => a.isSelected),
            uploadedFiles: this.uploadedFiles
        };
    }
    
    get showCcSection() {
        return this.hasCcRecipients || this.allowAdditionalRecipients;
    }
    
    get showBccSection() {
        return this. hasBccRecipients || this.allowAdditionalRecipients;
    }
    
    get isTemplateSelected() {
        return this.selectedTemplateId !== '' || this.isCustomEmail;
    }
}