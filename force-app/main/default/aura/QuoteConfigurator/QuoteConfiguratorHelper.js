({
    getEditorEl : function(component) {
        return component.find("editor").getElement();
    },

    getEditorText : function(component) {
        return this.getEditorEl(component).textContent || "";
    },
    syncAndSave : function(component) {
        let text = this.getEditorText(component);
        component.set("v.formula", text);
        this.pushHistory(component, text);
    },

       setEditorText : function(component, text) {
        let editor = this.getEditorEl(component);
        // Ensure we don't accidentally set "null" text
        editor.textContent = text || "";
           
           editor.spellcheck = false; 
           editor.setAttribute("spellcheck", "false");
           
        let range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false); // Move to end
        
        let sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        component._savedRange = range.cloneRange();
        
        // UPDATE: Add a tiny timeout to ensure the DOM is ready for the focus event
        window.setTimeout(function() {
            editor.focus();
        }, 10);
    },

    backspace : function(component) {
        this.restoreSelection(component);
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        
        const range = sel.getRangeAt(0);
        const editor = this.getEditorEl(component);
        
        // Safety check: ensure we are modifying the editor
        if (!editor.contains(range.startContainer)) return;

        if (!range.collapsed) {
            // If text is selected, just delete the selection
            range.deleteContents();
        } else {
            // If just a caret, delete previous character
            if (range.startOffset > 0) {
                // If inside a text node
                range.setStart(range.startContainer, range.startOffset - 1);
                range.deleteContents();
            } else {
                // Edge case: At start of a node (rare in simple textContent editors but possible)
                // For a simple text editor, this might happen at the very start of the box.
                // If offset is 0, we do nothing (cannot backspace further).
            }
        }
        
        component._savedRange = range.cloneRange();
    },

    saveSelection : function(component) {
        const editor = this.getEditorEl(component);
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return;
        component._savedRange = range.cloneRange();
    },

    restoreSelection : function(component) {
        const editor = this.getEditorEl(component);
        editor.focus();
        const sel = window.getSelection();
        sel.removeAllRanges();

        if (component._savedRange) {
            sel.addRange(component._savedRange);
        } else {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.addRange(range);
            component._savedRange = range.cloneRange();
        }
    },

    insertText : function(component, text) {
        this.restoreSelection(component);
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text + ' ');
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        component._savedRange = range.cloneRange();
    },
    
    insertNumber : function(component, text) {
        this.restoreSelection(component);
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        component._savedRange = range.cloneRange();
    },

    moveCaretInsideLastInsertedParens : function(component, insertedText) {
        const editor = this.getEditorEl(component);
        const content = editor.textContent || "";
        const idx = content.lastIndexOf(insertedText);
        if (idx === -1) return;

        let targetOffset;
        if (insertedText.indexOf('(,') !== -1) {
            targetOffset = idx + insertedText.indexOf('(') + 1;
        } else {
            targetOffset = idx + insertedText.length - 1;
        }

        editor.textContent = content; // Normalize text nodes
        const textNode = editor.firstChild;
        if (!textNode) return;

        const range = document.createRange();
        range.setStart(textNode, Math.min(targetOffset, textNode.length));
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        component._savedRange = range.cloneRange();
    },

    // --- History / Undo / Redo Logic ---

    pushHistory : function(component, newText) {
        let history = component.get("v.history");
        let pos = component.get("v.historyPos");

        // If the new text is same as current snapshot, ignore (avoids dups)
        if (pos >= 0 && history[pos] === newText) {
            return;
        }

        // If we are in the middle of the stack (undo was clicked),
        // chop off the "future" states.
        if (pos < history.length - 1) {
            history = history.slice(0, pos + 1);
        }

        history.push(newText);
        
        // Optional: Limit stack size (e.g., 50 steps)
        if(history.length > 50) {
            history.shift();
        } else {
            pos++; // Only increment if we didn't shift
        }
        
        // If we shifted, pos stays same (at end), if we didn't, pos moves to new end
        component.set("v.history", history);
        component.set("v.historyPos", history.length - 1);
    },

    undo : function(component) {
        let history = component.get("v.history");
        let pos = component.get("v.historyPos");

        if (pos > 0) {
            pos--;
            let previousText = history[pos];
            this.setEditorText(component, previousText);
            component.set("v.formula", previousText);
            component.set("v.historyPos", pos);
        }
    },

    redo : function(component) {
        let history = component.get("v.history");
        let pos = component.get("v.historyPos");

        if (pos < history.length - 1) {
            pos++;
            let nextText = history[pos];
            this.setEditorText(component, nextText);
            component.set("v.formula", nextText);
            component.set("v.historyPos", pos);
        }
    },
    
    validateFormula : function(component, callback) {
        let formula = this.getEditorText(component);
        
        if (!formula || formula.trim() === "") {
            this.showToast("Warning", "Formula is empty", "warning");
            return;
        }
        
        let action = component.get("c.validateFormula");
        action.setParams({ formula : formula });
        
        action.setCallback(this, function(response) {
            let state = response.getState();
            if (state === "SUCCESS") {
                let result = response.getReturnValue();
                
                if (result === 'VALID') {
                    //this.showToast("Success", "Formula is Valid!", "success");
                    if (callback) callback(true);
                } else {
                    this.showToast("Error", result, "error");
                    if (callback) callback(false);
                }
            } else {
                let errors = response.getError();
                let msg = (errors && errors[0] && errors[0].message) ? errors[0].message : "Unknown error";
                this.showToast("Error", "Validation Failed: " + msg, "error");
                if (callback) callback(false);
            }
        });
        $A.enqueueAction(action);
    },
    
    showToast : function(title, message, type) {
        let toastEvent = $A.get("e.force:showToast");
        if (toastEvent) {
            toastEvent.setParams({
                "title": title,
                "message": message,
                "type": type
            });
            toastEvent.fire();
        } else {
            alert(type.toUpperCase() + ": " + message);
        }
    }    
})