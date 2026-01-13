/**
 * @description Main controller for sending emails
 * @author Your Name
 * @date 2024
 */
public with sharing class EmailSenderController {
    
    // ============ WRAPPER CLASSES ============
    
    public class EmailDataWrapper {
        @AuraEnabled public String templateId { get; set; }
        @AuraEnabled public String recordId { get; set; }
        @AuraEnabled public String objectApiName { get; set; }
        @AuraEnabled public List<String> toAddresses { get; set; }
        @AuraEnabled public List<String> ccAddresses { get; set; }
        @AuraEnabled public List<String> bccAddresses { get; set; }
        @AuraEnabled public String fromAddressId { get; set; }
        @AuraEnabled public String replyTo { get; set; }
        @AuraEnabled public String subject { get; set; }
        @AuraEnabled public String body { get; set; }
        @AuraEnabled public List<AttachmentData> attachments { get; set; }
        @AuraEnabled public List<String> uploadedFileIds { get; set; }
    }
    
    public class AttachmentData {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String fileName { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public String vfPageName { get; set; }
        @AuraEnabled public String vfPageParam { get; set; }
        @AuraEnabled public String documentId { get; set; }
        @AuraEnabled public Boolean isSelected { get; set; }
    }
    
    public class RecipientData {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public String sourceType { get; set; }
        @AuraEnabled public String email { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public Boolean isRequired { get; set; }
        @AuraEnabled public Boolean isEditable { get; set; }
        @AuraEnabled public Boolean isValid { get; set; }
    }
    
    public class PreparedEmailData {
        @AuraEnabled public List<RecipientData> toRecipients { get; set; }
        @AuraEnabled public List<RecipientData> ccRecipients { get; set; }
        @AuraEnabled public List<RecipientData> bccRecipients { get; set; }
        @AuraEnabled public String subject { get; set; }
        @AuraEnabled public String body { get; set; }
        @AuraEnabled public String fromAddressId { get; set; }
        @AuraEnabled public String fromAddressLabel { get; set; }
        @AuraEnabled public String replyTo { get; set; }
        @AuraEnabled public List<EmailPdfGenerator.AttachmentInfo> attachments { get; set; }
        @AuraEnabled public Boolean allowAdditionalRecipients { get; set; }
        @AuraEnabled public Boolean allowFileUpload { get; set; }
    }
    
    public class EmailResult {
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public String activityId { get; set; }
    }
    
    // ============ GET OBJECT API NAME FROM RECORD ID ============
    
    /**
     * @description Get object API name from record ID
     * @param recordId Record ID
     * @return Object API name
     */
    @AuraEnabled(cacheable=true)
    public static String getObjectApiName(Id recordId) {
        if (recordId == null) {
            return null;
        }
        return recordId.getSObjectType().getDescribe().getName();
    }
    
    // ============ PREPARE EMAIL DATA ============
    
    /**
     * @description Prepare email data from template for a specific record
     * @param templateId Template ID
     * @param recordId Record ID
     * @return PreparedEmailData
     */
    @AuraEnabled
    public static PreparedEmailData prepareEmailFromTemplate(String templateId, String recordId) {
        try {
            if (String.isBlank(templateId) || String.isBlank(recordId)) {
                throw new AuraHandledException('Template ID and Record ID are required');
            }
            
            // Get template
            EmailTemplateConfigController.TemplateWrapper template = 
                EmailTemplateConfigController.getTemplateById(templateId);
            
            if (template == null) {
                throw new AuraHandledException('Template not found');
            }
            
            String objectApiName = template.objectApiName;
            
            PreparedEmailData preparedData = new PreparedEmailData();
            
            // Resolve recipients
            preparedData.toRecipients = resolveRecipients(template.recipientsConfig, 'to', recordId, objectApiName);
            preparedData.ccRecipients = resolveRecipients(template.recipientsConfig, 'cc', recordId, objectApiName);
            preparedData.bccRecipients = resolveRecipients(template.recipientsConfig, 'bcc', recordId, objectApiName);
            
            // Resolve subject and body with merge fields
            preparedData.subject = EmailMergeFieldResolver.resolveMergeFields(
                template.subject, recordId, objectApiName
            );
            preparedData.body = EmailMergeFieldResolver.resolveMergeFields(
                template.emailBody, recordId, objectApiName
            );
            
            // From address
            preparedData.fromAddressId = template.fromAddress;
            if (String.isNotBlank(template.fromAddress)) {
                preparedData.fromAddressLabel = getFromAddressLabel(template.fromAddress);
            }
            
            // Reply to
            preparedData.replyTo = template.replyTo;
            
            // Attachments
            preparedData.attachments = EmailPdfGenerator.getAttachmentInfoList(
                template.attachmentsConfig, recordId, objectApiName
            );
            
            // Options
            preparedData.allowAdditionalRecipients = template.allowAdditionalRecipients;
            preparedData.allowFileUpload = template.allowFileUpload;
            
            return preparedData;
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error preparing email: ' + e.getMessage());
        }
    }
    
    /**
     * @description Prepare blank email (custom email without template)
     * @param recordId Record ID
     * @param objectApiName Object API name
     * @return PreparedEmailData
     */
    @AuraEnabled
    public static PreparedEmailData prepareBlankEmail(String recordId, String objectApiName) {
        try {
            PreparedEmailData preparedData = new PreparedEmailData();
            
            preparedData.toRecipients = new List<RecipientData>();
            preparedData.ccRecipients = new List<RecipientData>();
            preparedData.bccRecipients = new List<RecipientData>();
            preparedData.subject = '';
            preparedData.body = '';
            preparedData.attachments = new List<EmailPdfGenerator.AttachmentInfo>();
            preparedData.allowAdditionalRecipients = true;
            preparedData.allowFileUpload = true;
            
            return preparedData;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error preparing blank email: ' + e.getMessage());
        }
    }
    
    // ============ RESOLVE RECIPIENTS ============
    
    /**
     * @description Resolve recipients from config JSON
     */
    private static List<RecipientData> resolveRecipients(
        String recipientsConfigJson, 
        String recipientType, 
        Id recordId, 
        String objectApiName
    ) {
        List<RecipientData> recipients = new List<RecipientData>();
        
        try {
            if (String.isBlank(recipientsConfigJson)) {
                return recipients;
            }
            
            Map<String, Object> config = (Map<String, Object>) JSON.deserializeUntyped(recipientsConfigJson);
            List<Object> recipientList = (List<Object>) config.get(recipientType);
            
            if (recipientList == null) {
                return recipients;
            }
            
            for (Object rec : recipientList) {
                Map<String, Object> recMap = (Map<String, Object>) rec;
                
                RecipientData data = new RecipientData();
                data.id = (String) recMap.get('id');
                data.type = recipientType.toUpperCase();
                data.sourceType = (String) recMap.get('sourceType');
                data.label = (String) recMap.get('label');
                data.isRequired = recMap.get('isRequired') == true;
                data.isEditable = recMap.get('isEditable') == true;
                
                // Resolve email based on source type
                String sourceType = data.sourceType;
                String fieldApiName = (String) recMap.get('fieldApiName');
                String staticEmail = (String) recMap.get('staticEmail');
                
                data.email = EmailMergeFieldResolver.resolveRecipientEmail(
                    sourceType, fieldApiName, staticEmail, recordId, objectApiName
                );
                
                data.isValid = String.isNotBlank(data.email) && isValidEmail(data.email);
                
                recipients.add(data);
            }
            
        } catch (Exception e) {
            System.debug('Error resolving recipients: ' + e.getMessage());
        }
        
        return recipients;
    }
    
    /**
     * @description Get from address label
     */
    private static String getFromAddressLabel(String fromAddressId) {
        try {
            if (String.isBlank(fromAddressId)) {
                return null;
            }
            
            List<OrgWideEmailAddress> oweas = [
                SELECT DisplayName, Address
                FROM OrgWideEmailAddress
                WHERE Id = :fromAddressId
                LIMIT 1
            ];
            
            if (!oweas.isEmpty()) {
                return oweas[0].DisplayName + ' <' + oweas[0].Address + '>';
            }
            
        } catch (Exception e) {
            System.debug('Error getting from address: ' + e.getMessage());
        }
        
        return null;
    }
    
    // ============ SEND EMAIL ============
    
    /**
     * @description Send email
     * @param emailDataJson JSON string of EmailDataWrapper
     * @return EmailResult
     */
    @AuraEnabled
    public static EmailResult sendEmail(String emailDataJson) {
        EmailResult result = new EmailResult();
        
        try {
            if (String.isBlank(emailDataJson)) {
                throw new AuraHandledException('Email data is required');
            }
            
            EmailDataWrapper emailData = (EmailDataWrapper) JSON.deserialize(
                emailDataJson, EmailDataWrapper.class
            );
            
            // Validate
            validateEmailData(emailData);
            
            // Create email message
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            
            // Set recipients
            if (emailData.toAddresses != null && !emailData.toAddresses.isEmpty()) {
                email.setToAddresses(emailData.toAddresses);
            }
            if (emailData.ccAddresses != null && !emailData.ccAddresses.isEmpty()) {
                email.setCcAddresses(emailData.ccAddresses);
            }
            if (emailData.bccAddresses != null && !emailData.bccAddresses.isEmpty()) {
                email.setBccAddresses(emailData.bccAddresses);
            }
            
            // Set from address
            if (String.isNotBlank(emailData.fromAddressId)) {
                email.setOrgWideEmailAddressId(emailData.fromAddressId);
            }
            
            // Set reply to
            if (String.isNotBlank(emailData.replyTo)) {
                email.setReplyTo(emailData.replyTo);
            }
            
            // Set subject and body
            email.setSubject(emailData.subject);
            email.setHtmlBody(emailData.body);
            
            // Set related record for activity tracking
            if (String.isNotBlank(emailData.recordId)) {
                // Check if object supports WhatId
                String objectApiName = emailData.objectApiName;
                if (isWhatIdSupported(objectApiName)) {
                    email.setWhatId(emailData.recordId);
                }
            }
            
            // Save as activity
            email.setSaveAsActivity(true);
            
            // Generate attachments
            List<Messaging.EmailFileAttachment> attachments = generateAttachments(emailData);
            if (!attachments.isEmpty()) {
                email.setFileAttachments(attachments);
            }
            
            // Send email
            Messaging.SendEmailResult[] sendResults = Messaging.sendEmail(
                new Messaging.SingleEmailMessage[] { email }
            );
            
            if (sendResults[0].isSuccess()) {
                result.success = true;
                result.message = 'Email sent successfully';
            } else {
                result.success = false;
                Messaging.SendEmailError[] errors = sendResults[0].getErrors();
                result.message = errors[0].getMessage();
            }
            
        } catch (AuraHandledException e) {
            result.success = false;
            result.message = e.getMessage();
        } catch (Exception e) {
            result.success = false;
            result.message = 'Error sending email: ' + e.getMessage();
        }
        
        return result;
    }
    
    /**
     * @description Validate email data before sending
     */
    private static void validateEmailData(EmailDataWrapper emailData) {
        if (emailData.toAddresses == null || emailData.toAddresses.isEmpty()) {
            throw new AuraHandledException('At least one recipient is required');
        }
        
        if (String.isBlank(emailData.subject)) {
            throw new AuraHandledException('Subject is required');
        }
        
        if (String.isBlank(emailData.body)) {
            throw new AuraHandledException('Email body is required');
        }
        
        // Validate email addresses
        for (String email : emailData.toAddresses) {
            if (!isValidEmail(email)) {
                throw new AuraHandledException('Invalid email address: ' + email);
            }
        }
    }
    
    /**
     * @description Check if email address is valid
     */
    private static Boolean isValidEmail(String email) {
        if (String.isBlank(email)) {
            return false;
        }
        String emailRegex = '^[a-zA-Z0-9._|\\\\%#~`=?&/$^*!}{+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$';
        Pattern emailPattern = Pattern.compile(emailRegex);
        Matcher matcher = emailPattern.matcher(email);
        return matcher.matches();
    }
    
    /**
     * @description Check if object supports WhatId
     */
    private static Boolean isWhatIdSupported(String objectApiName) {
        // Objects that support WhatId for email activities
        Set<String> supportedObjects = new Set<String>{
            'Account', 'Opportunity', 'Contract', 'Order', 'Campaign',
            'Case', 'Solution', 'Product2', 'Asset'
        };
        
        // Custom objects generally support WhatId
        if (objectApiName.endsWith('__c')) {
            return true;
        }
        
        return supportedObjects.contains(objectApiName);
    }
    
    /**
     * @description Generate email attachments
     */
    private static List<Messaging.EmailFileAttachment> generateAttachments(EmailDataWrapper emailData) {
        List<Messaging.EmailFileAttachment> attachments = new List<Messaging.EmailFileAttachment>();
        
        try {
            // Process template attachments
            if (emailData.attachments != null && !emailData.attachments.isEmpty()) {
                for (AttachmentData att : emailData.attachments) {
                    // Skip if attachment is null or not selected
                    if (att == null || att.isSelected == null || !att.isSelected) {
                        continue;
                    }
                    
                    Messaging.EmailFileAttachment fileAtt;
                    
                    if (att.type == 'VFPage') {
                        String paramName = String.isNotBlank(att.vfPageParam) ? att.vfPageParam : 'id';
                        fileAtt = EmailPdfGenerator.generatePdfAttachment(
                            att.vfPageName,
                            emailData.recordId,
                            att.fileName,
                            paramName
                        );
                    } else if (att.type == 'StaticDocument') {
                        fileAtt = EmailPdfGenerator.getStaticDocumentAttachment(att.documentId);
                    }
                    
                    if (fileAtt != null) {
                        attachments.add(fileAtt);
                    }
                }
            }
            
            // Process uploaded files
            if (emailData.uploadedFileIds != null && !emailData.uploadedFileIds.isEmpty()) {
                List<ContentVersion> files = [
                    SELECT Title, FileExtension, VersionData
                    FROM ContentVersion
                    WHERE ContentDocumentId IN :emailData.uploadedFileIds
                    AND IsLatest = true
                ];
                
                for (ContentVersion cv : files) {
                    Messaging.EmailFileAttachment fileAtt = new Messaging.EmailFileAttachment();
                    fileAtt.setFileName(cv.Title + '.' + cv.FileExtension);
                    fileAtt.setBody(cv.VersionData);
                    attachments.add(fileAtt);
                }
            }
            
        } catch (Exception e) {
            System.debug('Error generating attachments: ' + e.getMessage());
            // Consider logging this error or throwing it based on business requirements
        }
        
        return attachments;
    }
    
    // ============ GET RELATED FILES ============
    
    /**
     * @description Get files related to a record for attachment selection
     * @param recordId Record ID
     * @return List of file info
     */
    @AuraEnabled
    public static List<Map<String, Object>> getRelatedFiles(String recordId) {
        List<Map<String, Object>> files = new List<Map<String, Object>>();
        
        try {
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.Title, 
                       ContentDocument.FileExtension, ContentDocument.ContentSize
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :recordId
                ORDER BY ContentDocument.Title
            ];
            
            for (ContentDocumentLink link : links) {
                Map<String, Object> fileInfo = new Map<String, Object>();
                fileInfo.put('id', link.ContentDocumentId);
                fileInfo.put('name', link.ContentDocument.Title);
                fileInfo.put('extension', link.ContentDocument.FileExtension);
                fileInfo.put('size', link.ContentDocument.ContentSize);
                fileInfo.put('fileName', link.ContentDocument.Title + '.' + link.ContentDocument.FileExtension);
                files.add(fileInfo);
            }
            
        } catch (Exception e) {
            System.debug('Error getting related files: ' + e.getMessage());
        }
        
        return files;
    }
}