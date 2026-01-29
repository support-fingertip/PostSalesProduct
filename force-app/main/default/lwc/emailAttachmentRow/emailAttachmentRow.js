import { LightningElement, api, track } from 'lwc';
import getVisualforcePages from '@salesforce/apex/EmailFieldPickerController.getVisualforcePages';
import getRelatedObjects from '@salesforce/apex/EmailFieldPickerController.getRelatedObjects';
import getFieldsForObject from '@salesforce/apex/EmailFieldPickerController.getFieldsForObject';

export default class EmailAttachmentRow extends LightningElement {
    @api index;
    @api objectApiName;
    @api attachmentData = {};
    @api canDelete = false;
    
    @track localData = {};
    @track vfPageOptions = [];
    @track relationshipOptions = [];
    @track relatedObjectFields = [];
    @track filterConditions = [];
    
    attachmentTypeOptions = [
        { label: 'Visualforce Page (PDF)', value: 'VFPage' },
        { label: 'Static Document', value: 'StaticDocument' }
    ];
    
    recordSourceOptions = [
        { label: 'Direct Record', value: 'Direct' },
        { label: 'Related Record', value: 'Related' }
    ];
    
    childRecordTypeOptions = [
        { label: 'Single Specific Child', value: 'Single' },
        { label: 'All Children', value: 'All' }
    ];
    
    operatorOptions = [
        { label: 'Equals (=)', value: '=' },
        { label: 'Not Equals (!=)', value: '!=' },
        { label: 'Greater Than (>)', value: '>' },
        { label: 'Less Than (<)', value: '<' },
        { label: 'Greater or Equal (>=)', value: '>=' },
        { label: 'Less or Equal (<=)', value: '<=' },
        { label: 'Contains (LIKE)', value: 'LIKE' },
        { label: 'Starts With', value: 'STARTS_WITH' }
    ];
    
    connectedCallback() {
        this.localData = { 
            ...this.attachmentData,
            recordSourceType: this.attachmentData.recordSourceType || 'Direct',
            selectedRelationship: this.attachmentData.selectedRelationship || '',
            childRecordType: this.attachmentData.childRecordType || 'All',
            vfPageParam: this.attachmentData.vfPageParam || 'id',
            maxChildRecords: this.attachmentData.maxChildRecords || 10
        };
        
        // Load filter conditions if they exist
        if (this.attachmentData.filterConditionsJson) {
            try {
                this.filterConditions = JSON.parse(this.attachmentData.filterConditionsJson);
            } catch(e) {
                this.filterConditions = [];
            }
        }
        
        this.loadVfPages();
        if (this.objectApiName) {
            this.loadRelatedObjects();
        }
    }
    
    async loadVfPages() {
        try {
            const pages = await getVisualforcePages();
            this.vfPageOptions = pages.map(page => ({
                label: page.label,
                value: page.value
            }));
        } catch (error) {
            console.error('Error loading VF pages:', error);
        }
    }
    
    async loadRelatedObjects() {
        try {
            const relationships = await getRelatedObjects({ 
                objectApiName: this.objectApiName 
            });
            
            this.relationshipOptions = relationships.map(rel => ({
                label: rel.label,
                value: rel.value,
                relationshipType: rel.relationshipType,
                relationshipName: rel.relationshipName,
                relatedObjectApi: rel.relatedObjectApi
            }));
            
            // If relationship already selected, load its fields
            if (this.localData.selectedRelationship) {
                await this.loadRelatedObjectFields();
            }
            
        } catch (error) {
            console.error('Error loading related objects:', error);
        }
    }
    
    async loadRelatedObjectFields() {
        try {
            const selectedRel = this.relationshipOptions.find(
                opt => opt.value === this.localData.selectedRelationship
            );
            
            if (!selectedRel || !selectedRel.relatedObjectApi) {
                this.relatedObjectFields = [];
                return;
            }
            
            const fields = await getFieldsForObject({ 
                objectApiName: selectedRel.relatedObjectApi 
            });
            
            this.relatedObjectFields = fields.map(field => ({
                label: field.label,
                value: field.value,
                type: field.type
            }));
            
        } catch (error) {
            console.error('Error loading related object fields:', error);
            this.relatedObjectFields = [];
        }
    }
    
    // ============ EVENT HANDLERS ============
    
    handleNameChange(event) {
        this.localData.name = event.target.value;
        this.notifyChange();
    }
    
    handleTypeChange(event) {
        this.localData.type = event.detail.value;
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
        this.localData.documentId = event.target.value;
        this.notifyChange();
    }
    
    handleFileNamePatternChange(event) {
        this.localData.fileNamePattern = event.target.value;
        this.notifyChange();
    }
    
    handleDefaultCheckedChange(event) {
        this.localData.isDefaultChecked = event.target.checked;
        this.notifyChange();
    }
    
    handleRequiredChange(event) {
        this.localData.isRequired = event.target.checked;
        if (event.target.checked) {
            this.localData.isDefaultChecked = true;
        }
        this.notifyChange();
    }
    
    handleRecordSourceChange(event) {
        this.localData.recordSourceType = event.detail.value;
        // Reset related selections
        this.localData.selectedRelationship = '';
        this.localData.childRecordType = 'All';
        this.filterConditions = [];
        this.relatedObjectFields = [];
        this.notifyChange();
    }
    
    async handleRelationshipChange(event) {
        this.localData.selectedRelationship = event.detail.value;
        this.filterConditions = [];
        await this.loadRelatedObjectFields();
        this.notifyChange();
    }
    
    handleChildRecordTypeChange(event) {
        this.localData.childRecordType = event.detail.value;
        if (event.detail.value === 'Single' && this.filterConditions.length === 0) {
            this.handleAddCondition();
        }
        this.notifyChange();
    }
    
    handleMaxRecordsChange(event) {
        this.localData.maxChildRecords = event.target.value;
        this.notifyChange();
    }
    
    // ============ CONDITION BUILDER ============
    
    handleAddCondition() {
        this.filterConditions = [
            ...this.filterConditions,
            {
                id: this.generateId(),
                field: '',
                operator: '=',
                value: ''
            }
        ];
        this.notifyChange();
    }
    
    handleRemoveCondition(event) {
        const conditionId = event.target.dataset.id;
        this.filterConditions = this.filterConditions.filter(c => c.id !== conditionId);
        this.notifyChange();
    }
    
    handleConditionFieldChange(event) {
        const conditionId = event.target.dataset.id;
        this.filterConditions = this.filterConditions.map(c => {
            if (c.id === conditionId) {
                return { ...c, field: event.detail.value };
            }
            return c;
        });
        this.notifyChange();
    }
    
    handleConditionOperatorChange(event) {
        const conditionId = event.target.dataset.id;
        this.filterConditions = this.filterConditions.map(c => {
            if (c.id === conditionId) {
                return { ...c, operator: event.detail.value };
            }
            return c;
        });
        this.notifyChange();
    }
    
    handleConditionValueChange(event) {
        const conditionId = event.target.dataset.id;
        this.filterConditions = this.filterConditions.map(c => {
            if (c.id === conditionId) {
                return { ...c, value: event.target.value };
            }
            return c;
        });
        this.notifyChange();
    }
    
    // ============ OTHER HANDLERS ============
    
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
        // Save filter conditions as JSON
        this.localData.filterConditionsJson = JSON.stringify(this.filterConditions);
        
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                index: this.index,
                data: { ...this.localData }
            }
        }));
    }
    
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
    
    // ============ GETTERS ============
    
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
        return this.localData.vfPageName || '';
    }
    
    get vfPageParam() {
        return this.localData.vfPageParam || 'id';
    }
    
    get documentId() {
        return this.localData.documentId || '';
    }
    
    get fileNamePattern() {
        return this.localData.fileNamePattern || '';
    }
    
    get isDefaultChecked() {
        return this.localData.isDefaultChecked || false;
    }
    
    get isRequired() {
        return this.localData.isRequired || false;
    }
    
    get showDeleteButton() {
        return this.canDelete !== false;
    }
    
    get recordSourceType() {
        return this.localData.recordSourceType || 'Direct';
    }
    
    get isDirectRecord() {
        return this.recordSourceType === 'Direct';
    }
    
    get isRelatedRecord() {
        return this.recordSourceType === 'Related';
    }
    
    get selectedRelationship() {
        return this.localData.selectedRelationship || '';
    }
    
    get selectedRelationshipLabel() {
        const rel = this.relationshipOptions.find(r => r.value === this.selectedRelationship);
        return rel ? rel.label : '';
    }
    
    get showChildRecordOptions() {
        if (!this.selectedRelationship) return false;
        const rel = this.relationshipOptions.find(r => r.value === this.selectedRelationship);
        return rel && rel.relationshipType === 'Child';
    }
    
    get childRecordType() {
        return this.localData.childRecordType || 'All';
    }
    
    get isSingleChild() {
        return this.childRecordType === 'Single';
    }
    
    get isAllChildren() {
        return this.childRecordType === 'All';
    }
    
    get maxChildRecords() {
        return this.localData.maxChildRecords || 10;
    }
    
    get hasConditions() {
        return this.filterConditions && this.filterConditions.length > 0;
    }
    
    get hasWhereClause() {
        return this.hasConditions && this.filterConditions.some(c => c.field && c.value);
    }
    
    get whereClausePreview() {
        if (!this.hasConditions) return '';
        
        const validConditions = this.filterConditions.filter(c => c.field && c.value);
        if (validConditions.length === 0) return '';
        
        const clauses = validConditions.map(c => {
            let value = c.value;
            
            // Add quotes for string values (except for numbers)
            if (isNaN(value) && !value.startsWith("'")) {
                if (c.operator === 'LIKE' || c.operator === 'STARTS_WITH') {
                    value = c.operator === 'LIKE' ? `'%${value}%'` : `'${value}%'`;
                } else {
                    value = `'${value}'`;
                }
            }
            
            const operator = c.operator === 'STARTS_WITH' ? 'LIKE' : c.operator;
            return `${c.field} ${operator} ${value}`;
        });
        
        return clauses.join(' AND ');
    }
    
    get showCompleteQueryPreview() {
        return this.showChildRecordOptions && this.selectedRelationship;
    }
    
    get completeQueryPreview() {
        if (!this.selectedRelationship) return '';
        
        const rel = this.relationshipOptions.find(r => r.value === this.selectedRelationship);
        if (!rel) return '';
        
        let query = `SELECT Id FROM ${rel.relatedObjectApi}\nWHERE ${rel.relationshipName} = :recordId`;
        
        if (this.isSingleChild && this.hasWhereClause) {
            query += `\n  AND ${this.whereClausePreview}`;
            query += `\nLIMIT 1`;
        } else if (this.isAllChildren) {
            query += `\nLIMIT ${this.maxChildRecords}`;
        }
        
        return query;
    }
    
    get currentObjectForMergeFields() {
        if (this.isRelatedRecord && this.selectedRelationship) {
            const rel = this.relationshipOptions.find(r => r.value === this.selectedRelationship);
            return rel ? rel.relatedObjectApi : this.objectApiName;
        }
        return this.objectApiName;
    }
    
    get recordSourceHelpText() {
        if (this.isDirectRecord) {
            return `PDF will be generated for the primary ${this.objectApiName} record.`;
        } else if (this.isRelatedRecord && this.selectedRelationship) {
            const rel = this.relationshipOptions.find(r => r.value === this.selectedRelationship);
            if (rel) {
                if (rel.relationshipType === 'Parent') {
                    return `PDF will be generated for the parent ${rel.relatedObjectApi} record.`;
                } else if (this.isAllChildren) {
                    return `Multiple PDFs will be generated - one for each child ${rel.relatedObjectApi} record (max ${this.maxChildRecords}).`;
                } else if (this.isSingleChild) {
                    return `PDF will be generated for ONE specific child ${rel.relatedObjectApi} record matching your filter.`;
                }
            }
        }
        return 'Select a record source type to configure the attachment.';
    }
}