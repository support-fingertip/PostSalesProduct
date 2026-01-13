import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getObjectList from '@salesforce/apex/FieldMapperController.getObjectList';
import getFieldList from '@salesforce/apex/FieldMapperController.getFieldList';
import getCompatibleFields from '@salesforce/apex/FieldMapperController.getCompatibleFields';
import saveMappingConfiguration from '@salesforce/apex/FieldMapperController.saveMappingConfiguration';

export default class FieldMapper extends LightningElement {
    @track fromObject = '';
    @track toObject = '';
    @track mappingName = '';
    @track mappingTrigger = 'Insert and Update';
    @track isActive = false;
    
    @track objectOptions = [];
    @track fromObjectFields = [];
    @track toObjectFields = [];
    @track lookupFieldOptions = [];
    @track fieldMappings = [];
    
    @track showFromFields = false;
    @track showToFields = false;
    
    mappingTriggerOptions = [
        { label: 'Insert Only', value: 'Insert Only' },
        { label: 'Update Only', value: 'Update Only' },
        { label: 'Insert and Update', value: 'Insert and Update' }
    ];
    
    connectedCallback() {
        this.loadObjects();
    }
    
    loadObjects() {
        getObjectList()
            .then(result => {
                this.objectOptions = result.map(obj => ({
                    label: obj.label,
                    value: obj.apiName
                }));
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load objects: ' + error.body.message, 'error');
            });
    }
    
    handleFromObjectChange(event) {
        this.fromObject = event.detail.value;
        this.showFromFields = false;
        this.fieldMappings = [];
        
        if (this.fromObject) {
            this.loadFromObjectFields();
            if (this.toObject) {
                this.loadLookupFields();
            }
        }
    }
    
    handleToObjectChange(event) {
        this.toObject = event.detail.value;
        this.showToFields = false;
        this.fieldMappings = [];
        
        if (this.toObject) {
            this.loadToObjectFields();
            if (this.fromObject) {
                this.loadLookupFields();
            }
        }
    }
    
    loadFromObjectFields() {
        getFieldList({ objectApiName: this.fromObject })
            .then(result => {
                this.fromObjectFields = result.map(field => ({
                    label: field.label + ' (' + field.apiName + ')',
                    value: field.apiName,
                    type: field.type
                }));
                this.showFromFields = true;
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load from object fields: ' + error.body.message, 'error');
            });
    }
    
    loadToObjectFields() {
        getFieldList({ objectApiName: this.toObject })
            .then(result => {
                this.toObjectFields = result.map(field => ({
                    label: field.label + ' (' + field.apiName + ')',
                    value: field.apiName,
                    type: field.type
                }));
                this.showToFields = true;
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load to object fields: ' + error.body.message, 'error');
            });
    }
    
    loadLookupFields() {
        getFieldList({ objectApiName: this.fromObject })
            .then(result => {
                this.lookupFieldOptions = result
                    .filter(field => field.type === 'REFERENCE' && field.referenceTo === this.toObject)
                    .map(field => ({
                        label: field.label + ' (' + field.apiName + ')',
                        value: field.apiName
                    }));
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load lookup fields: ' + error.body.message, 'error');
            });
    }
    
    handleMappingNameChange(event) {
        this.mappingName = event.detail.value;
    }
    
    handleMappingTriggerChange(event) {
        this.mappingTrigger = event.detail.value;
    }
    
    handleIsActiveChange(event) {
        this.isActive = event.detail.checked;
    }
    
    addFieldMapping() {
        this.fieldMappings.push({
            id: Date.now(),
            fromField: '',
            toField: '',
            fromFieldType: '',
            toFieldType: '',
            compatibleToFields: []
        });
    }
    
    handleFromFieldChange(event) {
        const mappingId = parseInt(event.target.dataset.id);
        const selectedField = event.detail.value;
        
        const mapping = this.fieldMappings.find(m => m.id === mappingId);
        if (mapping) {
            mapping.fromField = selectedField;
            
            const fromFieldObj = this.fromObjectFields.find(f => f.value === selectedField);
            if (fromFieldObj) {
                mapping.fromFieldType = fromFieldObj.type;
                
                // Get compatible to fields
                getCompatibleFields({ 
                    objectApiName: this.toObject, 
                    fieldType: fromFieldObj.type 
                })
                    .then(result => {
                        mapping.compatibleToFields = result.map(field => ({
                            label: field.label + ' (' + field.apiName + ')',
                            value: field.apiName,
                            type: field.type
                        }));
                        this.fieldMappings = [...this.fieldMappings];
                    })
                    .catch(error => {
                        this.showToast('Error', 'Failed to load compatible fields: ' + error.body.message, 'error');
                    });
            }
        }
    }
    
    handleToFieldChange(event) {
        const mappingId = parseInt(event.target.dataset.id);
        const selectedField = event.detail.value;
        
        const mapping = this.fieldMappings.find(m => m.id === mappingId);
        if (mapping) {
            mapping.toField = selectedField;
            
            const toFieldObj = mapping.compatibleToFields.find(f => f.value === selectedField);
            if (toFieldObj) {
                mapping.toFieldType = toFieldObj.type;
            }
        }
    }
    
    removeFieldMapping(event) {
        const mappingId = parseInt(event.target.dataset.id);
        this.fieldMappings = this.fieldMappings.filter(m => m.id !== mappingId);
    }
    
    handleSave() {
        if (!this.validateInputs()) {
            return;
        }
        
        const mappingDetails = this.fieldMappings.map((mapping, index) => ({
            fromField: mapping.fromField,
            toField: mapping.toField,
            fromFieldType: mapping.fromFieldType,
            toFieldType: mapping.toFieldType,
            sequence: index + 1
        }));
        
        const configData = {
            mappingName: this.mappingName,
            fromObject: this.fromObject,
            toObject: this.toObject,
            isActive: this.isActive,
            mappingTrigger: this.mappingTrigger,
            mappingDetails: JSON.stringify(mappingDetails)
        };
        
        saveMappingConfiguration({ configData: JSON.stringify(configData) })
            .then(() => {
                this.showToast('Success', 'Field mapping configuration saved successfully', 'success');
                this.resetForm();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to save configuration: ' + error.body.message, 'error');
            });
    }
    
    validateInputs() {
        if (!this.mappingName) {
            this.showToast('Error', 'Please enter a mapping name', 'error');
            return false;
        }
        
        if (!this.fromObject || !this.toObject) {
            this.showToast('Error', 'Please select both From and To objects', 'error');
            return false;
        }
        
        if (this.fieldMappings.length === 0) {
            this.showToast('Error', 'Please add at least one field mapping', 'error');
            return false;
        }
        
        for (let mapping of this.fieldMappings) {
            if (!mapping.fromField || !mapping.toField) {
                this.showToast('Error', 'All field mappings must have both From and To fields selected', 'error');
                return false;
            }
        }
        
        return true;
    }
    
    resetForm() {
        this.fromObject = '';
        this.toObject = '';
        this.mappingName = '';
        this.mappingTrigger = 'Insert and Update';
        this.isActive = false;
        this.fieldMappings = [];
        this.showFromFields = false;
        this.showToFields = false;
    }
    
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}