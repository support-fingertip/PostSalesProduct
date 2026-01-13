({
    loadData : function(component) {
        let action = component.get("c.getConfigurationData");
        action.setCallback(this, function(res) {
            if(res.getState() === "SUCCESS") component.set("v.configData", res.getReturnValue());
        });
        $A.enqueueAction(action);

        let bucketsAction = component.get("c.getExistingBuckets");
        bucketsAction.setCallback(this, function(res) {
            if(res.getState() === "SUCCESS") component.set("v.buckets", res.getReturnValue());
        });
        $A.enqueueAction(bucketsAction);
    },

    showToast : function(title, message, type) {
        var toastEvent = $A.get("e.force:showToast");
        toastEvent.setParams({ "title": title, "message": message, "type": type });
        toastEvent.fire();
    }
})