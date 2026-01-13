import { LightningElement, api, track } from 'lwc';
import getPicklistValues from '@salesforce/apex/FormulaBuilderController.getPicklistValues';

export default class StepBuilder extends LightningElement {
    @api step;
    @api availableFields;
    @api bookingFields;
    @api existingVariables;

    
    @track picklistFieldsMap = {}; // Store picklist values for fields
    @track showPicklistSelector = false;
    @track currentPicklistField = '';
    @track currentPicklistTarget = ''; // 'left', 'right', 'true', or 'false'
    @track picklistOptions = [];
    @track localStep = {};
    @track showIfConditionBuilder = false;
    @track ifCondition = {};

    numberButtons = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'];
    
    comparisonOperators = [
        { label: 'Equal (==)', value: '==' },
        { label: 'Not Equal (!=)', value: '!=' },
        { label: 'Greater Than (>)', value: '>' },
        { label: 'Less Than (<)', value: '<' },
        { label: 'Greater or Equal (>=)', value: '>=' },
        { label: 'Less or Equal (<=)', value: '<=' }
    ];

    connectedCallback() {
        this.localStep = { ...this.step };
        if(!this.localStep.formula) {
            this.localStep.formula = '';
        }
        this.updateVariableNameFromLabel();
        this.resetIfCondition();
        this.loadPicklistValues();
    }

    get formulaPreview() {
        return this.localStep.formula || 'No formula yet...';
    }

    get variableNamePreview() {
        return this.localStep.variableName || 'stepVariable';
    }

    get hasExistingVariables() {
        return this.existingVariables && this.existingVariables.length > 0;
    }

    get conditionFieldOptions() {
        const combined = [
            ...this.availableFields,
            ...(this.existingVariables || []).map(v => ({ label: v, value: v }))
        ];
        return combined;
    }

    get ifConditionPreview() {
        if(this.ifCondition.leftValue && this.ifCondition.operator && 
           this.ifCondition.rightValue && this.ifCondition.trueValue && 
           this.ifCondition.falseValue) {
            return `IF(${this.ifCondition.leftValue} ${this.ifCondition.operator} ${this.ifCondition.rightValue}, ${this.ifCondition.trueValue}, ${this.ifCondition.falseValue})`;
        }
        return 'Fill all fields to see preview';
    }

    handleStepLabelChange(event) {
        this.localStep.stepLabel = event.detail.value;
        this.updateVariableNameFromLabel();
    }

    loadPicklistValues() {
    // Check which fields are picklists and load their values
    if(this.availableFields && this.availableFields.length > 0) {
        this.availableFields.forEach(field => {
            if(field.type === 'PICKLIST') {
                // Extract object and field API from label or store separately
                // For now, we'll load on-demand when user selects a picklist field
            }
        });
    }
}

    updateVariableNameFromLabel() {
        if(this.localStep.stepLabel) {
            // Convert "Basic Price" to "basicPrice"
            // Convert "Total With GST" to "totalWithGST"
            let varName = this.localStep.stepLabel
                .trim()
                .split(/\s+/) // Split by spaces
                .map((word, index) => {
                    word = word.replace(/[^a-zA-Z0-9]/g, ''); // Remove special chars
                    if(index === 0) {
                        return word.charAt(0).toLowerCase() + word.slice(1);
                    }
                    return word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join('');
            
            this.localStep.variableName = varName || 'stepVariable';
        } else {
            this.localStep.variableName = '';
        }
    }

    handleDescriptionChange(event) {
        this.localStep.description = event.detail.value;
    }

    handleStoreFieldChange(event) {
        this.localStep.storeInField = event.detail.value;
    }

    handleFieldSelect(event) {
        const fieldName = event.detail.value;
        if(fieldName) {
            this.appendToFormula(fieldName);
        }
    }

    handleOperatorClick(event) {
        const operator = event.target.dataset.value;
        this.appendToFormula(' ' + operator + ' ');
    }

    handleNumberClick(event) {
        const number = event.target.dataset.value;
        this.appendToFormula(number);
    }

    handleVariableClick(event) {
        const variable = event.target.dataset.value;
        this.appendToFormula(variable);
    }

    appendToFormula(text) {
        this.localStep.formula = (this.localStep.formula || '') + text;
    }

    handleClearFormula() {
        this.localStep.formula = '';
    }

    handleToggleIfCondition() {
        this.showIfConditionBuilder = !this.showIfConditionBuilder;
        if(this.showIfConditionBuilder) {
            this.resetIfCondition();
        }
    }

    resetIfCondition() {
        this.ifCondition = {
            leftValue: '',
            operator: '==',
            rightValue: '',
            trueValue: '',
            falseValue: ''
        };
    }

    handleIfLeftChange(event) {
    this.ifCondition.leftValue = event.detail.value;
    
    // Check if selected field is a picklist
    const selectedField = this.conditionFieldOptions.find(f => f.value === event.detail.value);
    if(selectedField && selectedField.type === 'PICKLIST') {
        // Load picklist values for Right Value dropdown
        this.loadPicklistForField(event.detail.value, 'right');
    }
}

    loadPicklistForField(fieldAPI, target) {
    // Determine which object this field belongs to
    // For now, we'll try target object first, then source
    const targetObjectAPI = this.getTargetObjectAPI(); // You need to pass this
    
    getPicklistValues({ 
        objectAPI: targetObjectAPI, 
        fieldAPI: fieldAPI 
    })
        .then(result => {
            this.picklistFieldsMap[fieldAPI] = result;
            
            // Show picklist selector modal or update dropdown
            if(target === 'right') {
                this.currentPicklistField = fieldAPI;
                this.currentPicklistTarget = 'right';
                this.picklistOptions = result.map(pv => ({
                    label: pv.label,
                    value: '"' + pv.value + '"' // Wrap in quotes for formula
                }));
            }
        })
        .catch(error => {
            console.error('Error loading picklist values:', error);
        });
}

get showPicklistForRight() {
    return this.picklistOptions && this.picklistOptions.length > 0;
}

    handleIfOperatorChange(event) {
        this.ifCondition.operator = event.detail.value;
    }

    handleIfRightChange(event) {
        this.ifCondition.rightValue = event.detail.value;
    }

    handleIfTrueChange(event) {
        this.ifCondition.trueValue = event.detail.value;
    }

    handleIfFalseChange(event) {
        this.ifCondition.falseValue = event.detail.value;
    }

    handleInsertTrueVariable(event) {
        const variable = event.target.dataset.value;
        this.ifCondition.trueValue = variable;
    }

    handleInsertFalseVariable(event) {
        const variable = event.target.dataset.value;
        this.ifCondition.falseValue = variable;
    }

    handleInsertIfCondition() {
        const ifStatement = this.ifConditionPreview;
        if(ifStatement !== 'Fill all fields to see preview') {
            this.appendToFormula(ifStatement);
            this.showIfConditionBuilder = false;
            this.resetIfCondition();
        } else {
            alert('Please fill all IF condition fields');
        }
    }

    handleCancelIfCondition() {
        this.showIfConditionBuilder = false;
        this.resetIfCondition();
    }

    handleSave() {
        if(!this.localStep.stepLabel || !this.localStep.formula) {
            alert('Step Label and Formula are required');
            return;
        }

        this.dispatchEvent(new CustomEvent('save', {
            detail: this.localStep
        }));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}