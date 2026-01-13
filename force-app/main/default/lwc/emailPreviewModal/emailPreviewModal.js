import { LightningElement, api, track } from 'lwc';

export default class EmailPreviewModal extends LightningElement {
    @api emailData;
    @api isLoading = false;
    
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
    
    handleEdit() {
        this.dispatchEvent(new CustomEvent('edit'));
    }
    
    handleSend() {
        this.dispatchEvent(new CustomEvent('send'));
    }
    
    // ============ GETTERS ============
    
    get hasEmailData() {
        return this.emailData !== null && this.emailData !== undefined;
    }
    
    get fromAddress() {
        return this.emailData?. fromAddressLabel || 'Default';
    }
    
    get toAddresses() {
        if (!this.emailData?.toAddresses) return '';
        return Array.isArray(this.emailData.toAddresses) 
            ? this. emailData.toAddresses.join(', ') 
            : this.emailData.toAddresses;
    }
    
    get ccAddresses() {
        if (!this.emailData?.ccAddresses) return '';
        return Array.isArray(this.emailData.ccAddresses) 
            ? this.emailData.ccAddresses.join(', ') 
            : this.emailData.ccAddresses;
    }
    
    get bccAddresses() {
        if (!this.emailData?.bccAddresses) return '';
        return Array.isArray(this.emailData.bccAddresses) 
            ? this. emailData.bccAddresses.join(', ') 
            : this.emailData.bccAddresses;
    }
    
    get hasCcAddresses() {
        return this. ccAddresses && this.ccAddresses. length > 0;
    }
    
    get hasBccAddresses() {
        return this. bccAddresses && this.bccAddresses.length > 0;
    }
    
    get subject() {
        return this.emailData?. subject || '';
    }
    
    get body() {
        return this.emailData?.body || '';
    }
    
    get attachments() {
        return this.emailData?.attachments || [];
    }
    
    get hasAttachments() {
        return this.attachments.length > 0;
    }
    
    get attachmentCount() {
        return this.attachments. length;
    }
    
    get uploadedFiles() {
        return this.emailData?.uploadedFiles || [];
    }
    
    get hasUploadedFiles() {
        return this.uploadedFiles. length > 0;
    }
}