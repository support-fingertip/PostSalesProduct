/**
 * @description Controller to dynamically fetch objects and fields for email template builder
 * ENHANCED: Now supports related object relationships for VF page attachments
 * @author Your Name
 * @date 2024
 */
public with sharing class EmailFieldPickerController {
    
    // ============ WRAPPER CLASSES ============
    
    /**
     * @description Wrapper for Object info - implements Comparable for sorting
     */
    public class ObjectWrapper implements Comparable {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String value { get; set; }
        
        public ObjectWrapper(String label, String value) {
            this.label = label;
            this.value = value;
        }
        
        /**
         * @description Compare method for sorting by label
         */
        public Integer compareTo(Object compareTo) {
            ObjectWrapper other = (ObjectWrapper) compareTo;
            if (this.label == null && other.label == null) {
                return 0;
            } else if (this.label == null) {
                return -1;
            } else if (other.label == null) {
                return 1;
            }
            return this.label.toLowerCase().compareTo(other.label.toLowerCase());
        }
    }
    
    /**
     * @description Wrapper for Field info - implements Comparable for sorting
     */
    public class FieldWrapper implements Comparable {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String value { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public String objectName { get; set; }
        @AuraEnabled public String relationshipName { get; set; }
        @AuraEnabled public String referenceTo { get; set; }
        @AuraEnabled public Boolean isEmail { get; set; }
        @AuraEnabled public Boolean isReference { get; set; }
        
        public FieldWrapper() {
            this.isEmail = false;
            this.isReference = false;
        }
        
        /**
         * @description Compare method for sorting by label
         */
        public Integer compareTo(Object compareTo) {
            FieldWrapper other = (FieldWrapper) compareTo;
            if (this.label == null && other.label == null) return 0;
            if (this.label == null) return -1;
            if (other.label == null) return 1;
            return this.label.toLowerCase().compareTo(other.label.toLowerCase());
        }
    }
    
    /**
     * @description Wrapper for relationship information
     */
    public class RelationshipWrapper implements Comparable {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String value { get; set; }
        @AuraEnabled public String relationshipType { get; set; } // 'Parent' or 'Child'
        @AuraEnabled public String relationshipName { get; set; }
        @AuraEnabled public String relatedObjectApi { get; set; }
        
        public RelationshipWrapper(String label, String value, String relationshipType, 
                                   String relationshipName, String relatedObjectApi) {
            this.label = label;
            this.value = value;
            this.relationshipType = relationshipType;
            this.relationshipName = relationshipName;
            this.relatedObjectApi = relatedObjectApi;
        }
        
        public Integer compareTo(Object compareTo) {
            RelationshipWrapper other = (RelationshipWrapper) compareTo;
            // Sort by type first (Parent before Child), then by label
            if (this.relationshipType != other.relationshipType) {
                return this.relationshipType.compareTo(other.relationshipType);
            }
            if (this.label == null && other.label == null) return 0;
            if (this.label == null) return -1;
            if (other.label == null) return 1;
            return this.label.toLowerCase().compareTo(other.label.toLowerCase());
        }
    }
    
    // ============ GET ALL OBJECTS ============
    
    /**
     * @description Get all accessible objects in the org
     * @return List of ObjectWrapper
     */
    @AuraEnabled(cacheable=true)
    public static List<ObjectWrapper> getAllObjects() {
        List<ObjectWrapper> objects = new List<ObjectWrapper>();
        
        try {
            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            
            for (String objectName :  globalDescribe.keySet()) {
                Schema.SObjectType sObjectType = globalDescribe.get(objectName);
                Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
                
                // Only include accessible, queryable objects
                if (describeResult.isAccessible() && 
                    describeResult.isQueryable() && 
                    !describeResult.isDeprecatedAndHidden()) {
                    
                    // Skip certain system objects
                    if (! isSystemObject(objectName)) {
                        objects.add(new ObjectWrapper(
                            describeResult.getLabel(),
                            describeResult.getName()
                        ));
                    }
                }
            }
            
            // Sort by label
            objects.sort();
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching objects:  ' + e.getMessage());
        }
        
        return objects;
    }
    
    /**
     * @description Check if object is a system object to exclude
     */
    private static Boolean isSystemObject(String objectName) {
        Set<String> excludedPrefixes = new Set<String>{
            'ApexTestResult', 'AsyncApexJob', 'CronTrigger', 'CronJobDetail',
            'LoginHistory', 'SetupAuditTrail', 'StaticResource', 'ApexClass',
            'ApexTrigger', 'ApexPage', 'ApexComponent', 'Profile', 'PermissionSet',
            'EntityDefinition', 'FieldDefinition', 'Publisher', 'PlatformEvent'
        };
        
        for (String prefix : excludedPrefixes) {
            if (objectName.startsWithIgnoreCase(prefix)) {
                return true;
            }
        }
        
        // Skip objects ending with Share, History, Feed, Tag, ChangeEvent
        if (objectName.endsWith('Share') || 
            objectName.endsWith('History') || 
            objectName.endsWith('Feed') || 
            objectName.endsWith('Tag') ||
            objectName.endsWith('ChangeEvent')) {
            return true;
        }
        
        return false;
    }
    
    // ============ GET FIELDS FOR OBJECT ============
    
    /**
     * @description Get all fields for a given object
     * @param objectApiName API name of the object
     * @return List of FieldWrapper
     */
    @AuraEnabled(cacheable=true)
    public static List<FieldWrapper> getFieldsForObject(String objectApiName) {
        List<FieldWrapper> fields = new List<FieldWrapper>();
        
        try {
            if (String.isBlank(objectApiName)) {
                return fields;
            }
            
            Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName);
            if (sObjectType == null) {
                throw new AuraHandledException('Object not found: ' + objectApiName);
            }
            
            Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
            Map<String, Schema.SObjectField> fieldMap = describeResult.fields.getMap();
            
            for (String fieldName : fieldMap.keySet()) {
                Schema.SObjectField field = fieldMap.get(fieldName);
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
                
                if (fieldDescribe.isAccessible()) {
                    FieldWrapper fw = new FieldWrapper();
                    fw.label = fieldDescribe.getLabel();
                    fw.value = fieldDescribe.getName();
                    fw.type = String.valueOf(fieldDescribe.getType());
                    fw.objectName = objectApiName;
                    fw.isEmail = (fieldDescribe.getType() == Schema.DisplayType.EMAIL);
                    fw.isReference = (fieldDescribe.getType() == Schema.DisplayType.REFERENCE);
                    
                    if (fw.isReference) {
                        fw.relationshipName = fieldDescribe.getRelationshipName();
                        List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                        if (!referenceTo.isEmpty()) {
                            fw.referenceTo = referenceTo[0].getDescribe().getName();
                        }
                    }
                    
                    fields.add(fw);
                }
            }
            
            // Sort by label
            fields.sort();
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching fields:  ' + e.getMessage());
        }
        
        return fields;
    }
    
    // ============ GET EMAIL FIELDS ONLY ============
    
    /**
     * @description Get only email fields for recipient selection
     * @param objectApiName API name of the object
     * @return List of FieldWrapper (email fields only)
     */
    @AuraEnabled(cacheable=true)
    public static List<FieldWrapper> getEmailFieldsForObject(String objectApiName) {
        List<FieldWrapper> emailFields = new List<FieldWrapper>();
        
        try {
            List<FieldWrapper> allFields = getFieldsForObject(objectApiName);
            
            for (FieldWrapper field : allFields) {
                if (field.isEmail) {
                    emailFields.add(field);
                }
            }
            
            // Also add email fields from related objects (up to 3 levels)
            List<FieldWrapper> relatedEmailFields = getRelatedEmailFields(objectApiName, 3);
            emailFields.addAll(relatedEmailFields);
            
            // Sort the combined list
            emailFields.sort();
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching email fields:  ' + e.getMessage());
        }
        
        return emailFields;
    }
    
    /**
     * @description Get email fields from related objects
     * @param objectApiName Base object API name
     * @param maxLevels Maximum relationship levels to traverse
     * @return List of FieldWrapper
     */
    private static List<FieldWrapper> getRelatedEmailFields(String objectApiName, Integer maxLevels) {
        List<FieldWrapper> relatedFields = new List<FieldWrapper>();
        
        try {
            // Get first level relationships
            List<FieldWrapper> level1Fields = getFieldsForObject(objectApiName);
            
            for (FieldWrapper field : level1Fields) {
                if (field.isReference && String.isNotBlank(field.referenceTo) && String.isNotBlank(field.relationshipName)) {
                    // Get email fields from related object
                    List<FieldWrapper> relatedObjFields = getFieldsForObject(field.referenceTo);
                    
                    for (FieldWrapper relField : relatedObjFields) {
                        if (relField.isEmail) {
                            FieldWrapper fw = new FieldWrapper();
                            fw.label = field.label + ' → ' + relField.label;
                            fw.value = field.relationshipName + '.' + relField.value;
                            fw.type = 'EMAIL';
                            fw.objectName = objectApiName;
                            fw.isEmail = true;
                            relatedFields.add(fw);
                        }
                        
                        // Level 2: Get relationships from related object
                        if (maxLevels >= 2 && relField.isReference && 
                            String.isNotBlank(relField.referenceTo) && 
                            String.isNotBlank(relField.relationshipName)) {
                            
                            List<FieldWrapper> level2Fields = getFieldsForObject(relField.referenceTo);
                            
                            for (FieldWrapper l2Field : level2Fields) {
                                if (l2Field.isEmail) {
                                    FieldWrapper fw = new FieldWrapper();
                                    fw.label = field.label + ' → ' + relField.label + ' → ' + l2Field.label;
                                    fw.value = field.relationshipName + '.' + relField.relationshipName + '.' + l2Field.value;
                                    fw.type = 'EMAIL';
                                    fw.objectName = objectApiName;
                                    fw.isEmail = true;
                                    relatedFields.add(fw);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.debug('Error getting related email fields: ' + e.getMessage());
        }
        
        return relatedFields;
    }
    
    // ============ GET MERGE FIELDS ============
    
    /**
     * @description Get all fields for merge field picker (up to 2 levels)
     * @param objectApiName API name of the object
     * @return List of FieldWrapper
     */
    @AuraEnabled(cacheable=true)
    public static List<FieldWrapper> getMergeFieldsForObject(String objectApiName) {
        List<FieldWrapper> mergeFields = new List<FieldWrapper>();
        
        try {
            // Level 1: Direct fields
            List<FieldWrapper> level1Fields = getFieldsForObject(objectApiName);
            for (FieldWrapper field : level1Fields) {
                if (! field.isReference) {
                    field.label = field.label;
                    mergeFields.add(field);
                }
            }
            
            // Level 2: Related fields
           for (FieldWrapper field : level1Fields) {
                if (field.isReference && String.isNotBlank(field.referenceTo) && String.isNotBlank(field.relationshipName)) {
                    List<FieldWrapper> level2Fields = getFieldsForObject(field.referenceTo);
                    
                    for (FieldWrapper l2Field : level2Fields) {
                        if (!l2Field.isReference) {
                            FieldWrapper fw = new FieldWrapper();
                            fw.label = field.label + ' → ' + l2Field.label;
                            fw.value = field.relationshipName + '.' + l2Field.value;
                            fw.type = l2Field.type;
                            fw.objectName = objectApiName;
                            mergeFields.add(fw);
                        }
                    }
                }
            }
            
            mergeFields.sort();
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching merge fields: ' + e.getMessage());
        }
        return mergeFields;
    }
    
    // ============ GET ORG-WIDE EMAIL ADDRESSES ============
    
    /**
     * @description Get all Org-Wide Email Addresses
     * @return List of ObjectWrapper
     */
    @AuraEnabled(cacheable=true)
    public static List<ObjectWrapper> getOrgWideEmailAddresses() {
        List<ObjectWrapper> addresses = new List<ObjectWrapper>();
        
        try {
            List<OrgWideEmailAddress> oweas = [
                SELECT Id, DisplayName, Address 
                FROM OrgWideEmailAddress 
                WHERE IsAllowAllProfiles = true
                ORDER BY DisplayName
            ];
            
            for (OrgWideEmailAddress owea : oweas) {
                addresses.add(new ObjectWrapper(
                    owea.DisplayName + ' <' + owea.Address + '>',
                    owea.Id
                ));
            }
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching org-wide emails: ' + e.getMessage());
        }
        
        return addresses;
    }
    
    // ============ GET VISUALFORCE PAGES ============
    
    /**
     * @description Get all Visualforce pages (for PDF attachment selection)
     * @return List of ObjectWrapper
     */
    @AuraEnabled(cacheable=true)
    public static List<ObjectWrapper> getVisualforcePages() {
        List<ObjectWrapper> pages = new List<ObjectWrapper>();
        
        try {
            List<ApexPage> vfPages = [
                SELECT Id, Name, NamespacePrefix, MasterLabel
                FROM ApexPage
                ORDER BY Name
            ];
            
            for (ApexPage page : vfPages) {
                String displayName = String.isNotBlank(page.MasterLabel) ? page.MasterLabel : page.Name;
                String apiName = String.isNotBlank(page.NamespacePrefix) 
                    ? page.NamespacePrefix + '__' + page.Name 
                    :  page.Name;
                    
                pages.add(new ObjectWrapper(displayName, apiName));
            }
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching VF pages: ' + e.getMessage());
        }
        
        return pages;
    }
    
    // ============ SEARCH RECORDS ============
    
    /**
     * @description Search records for preview sample selection
     * @param objectApiName Object API name
     * @param searchTerm Search term
     * @return List of record options
     */
    @AuraEnabled
    public static List<ObjectWrapper> searchRecords(String objectApiName, String searchTerm) {
        List<ObjectWrapper> records = new List<ObjectWrapper>();
        
        try {
            if (String.isBlank(objectApiName)) {
                return records;
            }
            
            // Get the Name field or first accessible text field
            String nameField = getNameField(objectApiName);
            
            String query = 'SELECT Id, ' + String.escapeSingleQuotes(nameField) + ' FROM ' + String.escapeSingleQuotes(objectApiName);
            
            if (String.isNotBlank(searchTerm) && searchTerm.length() >= 2) {
                String searchPattern = '%' + String.escapeSingleQuotes(searchTerm) + '%';
                query += ' WHERE ' + nameField + ' LIKE : searchPattern';
            }
            
            query += ' ORDER BY ' + nameField + ' LIMIT 20';
            
            List<SObject> results = Database.query(query);
            
            for (SObject record : results) {
                records.add(new ObjectWrapper(
                    String.valueOf(record.get(nameField)),
                    record.Id
                ));
            }
            
        } catch (Exception e) {
            throw new AuraHandledException('Error searching records: ' + e.getMessage());
        }
        
        return records;
    }
    
    /**
     * @description Get the name field for an object
     */
    private static String getNameField(String objectApiName) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName);
        Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
        Map<String, Schema.SObjectField> fieldMap = describeResult.fields.getMap();
        
        // Try Name first
        if (fieldMap.containsKey('Name')) {
            return 'Name';
        }
        
        // Try common name fields
        List<String> commonNameFields = new List<String>{'Subject', 'Title', 'CaseNumber', 'ContractNumber'};
        for (String fieldName : commonNameFields) {
            if (fieldMap.containsKey(fieldName.toLowerCase())) {
                return fieldName;
            }
        }
        
        // Return first accessible text field
        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
            if (fieldDescribe.isAccessible() && 
                fieldDescribe.getType() == Schema.DisplayType.STRING) {
                return fieldDescribe.getName();
            }
        }
        
        return 'Id';
    }
    
    // ============ GET RELATED OBJECTS (PARENT & CHILD) ============
    
    /**
     * @description Get all parent and child relationships for an object
     * @param objectApiName API name of the object
     * @return List of RelationshipWrapper
     */
    @AuraEnabled(cacheable=true)
    public static List<RelationshipWrapper> getRelatedObjects(String objectApiName) {
        List<RelationshipWrapper> relationships = new List<RelationshipWrapper>();
        
        try {
            if (String.isBlank(objectApiName)) {
                return relationships;
            }
            
            Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName);
            if (sObjectType == null) {
                throw new AuraHandledException('Object not found: ' + objectApiName);
            }
            
            Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
            
            // Get Parent Relationships (Lookup & Master-Detail fields)
            Map<String, Schema.SObjectField> fieldMap = describeResult.fields.getMap();
            for (String fieldName : fieldMap.keySet()) {
                Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
                
                if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE && 
                    fieldDescribe.isAccessible() &&
                    String.isNotBlank(fieldDescribe.getRelationshipName())) {
                    
                    List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                    if (!referenceTo.isEmpty()) {
                        Schema.SObjectType parentType = referenceTo[0];
                        Schema.DescribeSObjectResult parentDescribe = parentType.getDescribe();
                        
                        // Skip User, RecordType, and other system objects
                        if (!isSystemObject(parentDescribe.getName())) {
                            relationships.add(new RelationshipWrapper(
                                '⬆️ Parent: ' + fieldDescribe.getLabel() + ' (' + parentDescribe.getLabel() + ')',
                                'parent_' + fieldDescribe.getName(),
                                'Parent',
                                fieldDescribe.getRelationshipName(),
                                parentDescribe.getName()
                            ));
                        }
                    }
                }
            }
            
            // Get Child Relationships (Related Lists)
            List<Schema.ChildRelationship> childRelationships = describeResult.getChildRelationships();
            for (Schema.ChildRelationship childRel : childRelationships) {
                if (childRel.getRelationshipName() != null && 
                    childRel.getChildSObject() != null) {
                    
                    Schema.DescribeSObjectResult childDescribe = childRel.getChildSObject().getDescribe();
                    
                    // Skip if not accessible or is a system object
                    if (childDescribe.isAccessible() && 
                        !isSystemObject(childDescribe.getName())) {
                        
                        relationships.add(new RelationshipWrapper(
                            '⬇️ Child: ' + childDescribe.getLabelPlural() + ' (' + childRel.getRelationshipName() + ')',
                            'child_' + childRel.getRelationshipName(),
                            'Child',
                            childRel.getField().getDescribe().getName(), // Foreign key field
                            childDescribe.getName()
                        ));
                    }
                }
            }
            
            // Sort relationships
            relationships.sort();
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching related objects: ' + e.getMessage());
        }
        
        return relationships;
    }
}