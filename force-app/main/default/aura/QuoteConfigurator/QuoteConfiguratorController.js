({
    

    rememberSelection : function(component, event, helper) {
        helper.saveSelection(component);
    },

    syncFormula : function(component, event, helper) {
        helper.saveSelection(component);
        let currentText = helper.getEditorText(component);
        component.set("v.formula", currentText);
        
        // Save history on keyup (debouncing recommended for production, simplified here)
        helper.pushHistory(component, currentText);
        
        component.set("v.hasChanges", true);
    },

    insertField : function(component, event, helper) {
        let apiName = event.getSource().get("v.value");
        if (!apiName) return; 
        
        helper.insertText(component, apiName);
        
        let text = helper.getEditorText(component);
        component.set("v.formula", text);
        helper.pushHistory(component, text);
        
        component.set("v.hasChanges", true);
        component.set("v.selectedField", "");
    },

    insertOperator : function(component, event, helper) {
        let op = event.getSource().get("v.value");
        helper.insertText(component, op);
        
        let text = helper.getEditorText(component);
        component.set("v.formula", text);
        helper.pushHistory(component, text);
        
        component.set("v.hasChanges", true);
    },

    insertFunction : function(component, event, helper) {
        let fn = event.getSource().get("v.value");
        let insertText;
        if (fn === 'ROUND' || fn === 'MIN' || fn === 'MAX' || fn === 'POWER') {
            insertText = fn + '(, )';
        } else {
            insertText = fn + '()';
        }

        helper.insertText(component, insertText);
        helper.moveCaretInsideLastInsertedParens(component, insertText);
        
        let text = helper.getEditorText(component);
        component.set("v.formula", text);
        helper.pushHistory(component, text);
        
        component.set("v.hasChanges", true);
    },
                    
                    insertNumber : function(component, event, helper) {
                        let num = event.getSource().get("v.value");
                        helper.insertNumber(component, num);
                        helper.syncAndSave(component);
                    },
                    
    handleUndo : function(component, event, helper) {
        helper.undo(component);
        
        component.set("v.hasChanges", true);
    },

    handleRedo : function(component, event, helper) {
        helper.redo(component);
        
        component.set("v.hasChanges", true);
    },
                    
    handleSpace : function(component, event, helper) {
        helper.insertNumber(component, ' ');
        let text = helper.getEditorText(component);
        component.set("v.formula", text);
        helper.pushHistory(component, text);
        
        component.set("v.hasChanges", true);
    },
    
    handleBackspace : function(component, event, helper) {
        helper.backspace(component);
        let text = helper.getEditorText(component);
        component.set("v.formula", text);
        helper.pushHistory(component, text);
        
        component.set("v.hasChanges", true);
    },
            
    saveFormula : function(component, event, helper) {
        // Option 1: Validate before saving automatically
        helper.validateFormula(component, function(isValid) {
            if (isValid) {
                // Proceed to save if valid
                let formula = helper.getEditorText(component);
                let action = component.get("c.saveFormulaRec");
                action.setParams({
                    projectId : component.get("v.recordId"),
                    formula : formula
                });
                action.setCallback(this, function(resp) {
                    if (resp.getState() === "SUCCESS") {
                        $A.get("e.force:showToast").setParams({
                            title: "Success",
                            message: "Quote calculation logic saved successfully",
                            type: "success"
                        }).fire();
                        
                        component.set("v.hasChanges", false);
                        
                        component.set("v.history", [formula]);
                        component.set("v.historyPos", 0);
                    }
                });
                $A.enqueueAction(action);
            }
        });
    },
          
    doInit : function(component, event, helper) {
        component.set("v.operators", ['+','-','*','/','%','(',')']);
        
        component.set("v.functions", [
            'ROUND', 'CEIL', 'FLOOR', 'MIN', 'MAX', 'POWER'
        ]);
        //'ABS', 
        let action = component.get("c.getUnitNumericFields");
        action.setParams({recId : component.get("v.recordId")});
        action.setCallback(this, function(response) {
            if (response.getState() === "SUCCESS") {
                let result = response.getReturnValue();
                let options = result.FieldInfos.map(f => ({ label: f.label, value: f.apiName }));
                options.unshift({ label: "-- None --", value: "" });
                component.set("v.unitFields", options);
                component.set("v.formula", result.QuoteCalculationLogic);
                component.set("v.selectedField", "");
                
                let initialFormula = result.QuoteCalculationLogic || "";

                // Push initial state
                helper.pushHistory(component, initialFormula);
                
                window.setTimeout($A.getCallback(() => {
                    helper.setEditorText(component, initialFormula);
                }), 0);
            }
        });
        $A.enqueueAction(action);

        // Initialize editor and history
        
    },
})