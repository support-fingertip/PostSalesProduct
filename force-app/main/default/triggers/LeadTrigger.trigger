trigger LeadTrigger on Lead__c (before insert,after insert,after update) {
    if (Trigger.isBefore && Trigger.isInsert) {
        //Adding this change
        User us = [Select Id,Name From User LIMIT 1];
        Booking__c bk = [Select Id,Name from Booking__c  LIMIT 1];
        Project__c pro = [Select Id,Name from Project__c LIMIT 1];
        Unit__c uni = [Select Id,Name from Unit__c LIMIT 1];
        Contact con = [Select Id,LastName from Contact LIMIT 1];
System.debug('hello');
System.debug('hello');
System.debug('hello');
    }
}