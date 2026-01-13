({
    doInit : function(component, event, helper) {
        helper.loadData(component);
    },

    handleEdit : function(component, event, helper) {
        let bucket = event.getSource().get("v.value");
        component.set("v.newBucket", bucket);

        // Distribute users back to tabs
        let pre = [], sales = [], cp = [], post = [];
        if(bucket.Round_Robin_Members__r) {
            bucket.Round_Robin_Members__r.forEach(m => {
                if(m.Assignment_Type__c === 'Pre-Sales') pre.push(m.User__c);
                else if(m.Assignment_Type__c === 'Sales') sales.push(m.User__c);
                else if(m.Assignment_Type__c === 'Channel Partner') cp.push(m.User__c);
                else if(m.Assignment_Type__c === 'Post-Sales') post.push(m.User__c);
            });
        }
        component.set("v.preSalesUsers", pre);
        component.set("v.salesUsers", sales);
        component.set("v.cpUsers", cp);
        component.set("v.postSalesUsers", post);
        window.scrollTo(0,0);
    },

    handleSave : function(component, event, helper) {
        let action = component.get("c.saveBucket");
        action.setParams({
            "bucket": component.get("v.newBucket"),
            "categorizedUsers": {
                "Pre-Sales": component.get("v.preSalesUsers"),
                "Sales": component.get("v.salesUsers"),
                "Channel Partner": component.get("v.cpUsers"),
                "Post-Sales": component.get("v.postSalesUsers")
            }
        });
        action.setCallback(this, function(res) {
            if(res.getState() === "SUCCESS") {
                helper.showToast("Success", "Configuration saved.", "success");
                helper.loadData(component); // Refresh table
                
                // REFRESH SELECTION: Clear everything
                component.set("v.newBucket", {'sobjectType':'Round_Robin__c', 'Customer_Type__c':'Both', 'Is_Active__c':true});
                component.set("v.preSalesUsers", []);
                component.set("v.salesUsers", []);
                component.set("v.cpUsers", []);
                component.set("v.postSalesUsers", []);
            }
        });
        $A.enqueueAction(action);
    }
})