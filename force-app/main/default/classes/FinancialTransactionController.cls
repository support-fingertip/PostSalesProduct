/**
* @description Complete Financial Transaction Controller for Real Estate
* @author Your Name
* @date January 2026
* @version 1.0
*/
public with sharing class FinancialTransactionController {
    
    // ==================== GET BOOKING SUMMARY ====================
    
    @AuraEnabled(cacheable=true)
    public static BookingSummary getBookingSummary(String bookingId) {
        try {
            Booking__c booking = [
                SELECT Id, Name, Project__r.Name, Unit__r.Name,
                Total_Payable_Amount__c,
                Total_Credit_Notes__c,
                Total_Debit_Notes__c,
                Net_Payable_Value__c,
                Total_Demand_Raised__c,
                Total_Receipt_Amount__c,
                Outstanding_Demand_Amount__c,
                Advance_Payment_Available__c,
                Current_Payable_Balance__c,
                Future_Demand_Balance__c,
                Status__c//,
                //Payment_Status__c
                FROM Booking__c
                WHERE Id = :bookingId
                LIMIT 1
            ];
            
            BookingSummary summary = new BookingSummary();
            summary.bookingId = booking.Id;
            summary.bookingName = booking.Name;
            summary.projectName = booking.Project__r.Name;
            summary.unitNumber = booking.Unit__r.Name;
            
            summary.originalAgreementValue = booking.Total_Payable_Amount__c ?? 0;
            summary.totalCreditNotes = booking.Total_Credit_Notes__c ?? 0;
            summary.totalDebitNotes = booking.Total_Debit_Notes__c ?? 0;
            summary.netAgreementValue = booking.Net_Payable_Value__c ?? 0;
            
            summary.totalDemandRaised = booking.Total_Demand_Raised__c ?? 0;
            summary.totalReceiptAmount = booking.Total_Receipt_Amount__c ?? 0;
            summary.outstandingDemandAmount = booking.Outstanding_Demand_Amount__c ?? 0;
            summary.advancePaymentAvailable = booking.Advance_Payment_Available__c ?? 0;
            
            summary.currentPayableBalance = booking.Current_Payable_Balance__c ?? 0;
            summary.futureDemandBalance = booking.Future_Demand_Balance__c ?? 0;
            
            summary.bookingStatus = booking.Status__c;
            //summary.paymentStatus = booking.Payment_Status__c;
            
            return summary;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching booking summary: ' + e.getMessage());
        }
    }
    
    // ==================== GET OPEN DEMANDS ====================
    
    @AuraEnabled(cacheable=true)
    public static List<DemandInfo> getOpenDemands(String bookingId) {
        try {
            // Query all open demands
            List<Demands__c> allDemands = [
                SELECT Id, Name, Demand_Date__c, Due_Date__c,
                Demand_Amount__c, Previous_Dues__c,
                Interest_Amount__c,
                Net_Demand_Amount__c, Pending_Amount__c,
                Status__c, Demand_Type__c, Days_Overdue__c,
                Payment_Schedule__c, Payment_Schedule__r.Name
                FROM Demands__c
                WHERE Booking__c = :bookingId
                AND Status__c IN ('Open', 'Partial')
                AND Pending_Amount__c > 0
                ORDER BY Due_Date__c ASC
            ];
            
            // Sort in memory by priority: Interest > Debit Note > Others
            List<Demands__c> interestDemands = new List<Demands__c>();
            List<Demands__c> debitNoteDemands = new List<Demands__c>();
            List<Demands__c> otherDemands = new List<Demands__c>();
            
            for (Demands__c d : allDemands) {
                if (d.Demand_Type__c == 'Interest') {
                    interestDemands.add(d);
                } else if (d.Demand_Type__c == 'Debit Note') {
                    debitNoteDemands.add(d);
                } else {
                    otherDemands.add(d);
                }
            }
            
            // Combine in priority order
            List<Demands__c> sortedDemands = new List<Demands__c>();
            sortedDemands.addAll(interestDemands);
            sortedDemands.addAll(debitNoteDemands);
            sortedDemands.addAll(otherDemands);
            
            // Convert to DemandInfo
            List<DemandInfo> demandList = new List<DemandInfo>();
            for (Demands__c d : sortedDemands) {
                DemandInfo info = new DemandInfo();
                info.demandId = d.Id;
                info.demandNumber = d.Name;
                info.milestoneName = d.Payment_Schedule__r.Name;
                info.demandDate = d.Demand_Date__c;
                info.dueDate = d.Due_Date__c;
                info.totalDemandAmount = d.Net_Demand_Amount__c;
                info.pendingAmount = d.Pending_Amount__c;
                info.demandType = d.Demand_Type__c;
                info.status = d.Status__c;
                info.daysOverdue = d.Days_Overdue__c != null ? Integer.valueOf(d.Days_Overdue__c) : 0;
                info.isOverdue = info.daysOverdue > 0;
                demandList.add(info);
            }
            
            return demandList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching open demands: ' + e.getMessage());
        }
    }
    
    // ==================== GET AVAILABLE CREDITS ====================
    
    
    @AuraEnabled(cacheable=true)
    public static List<CreditNoteInfo> getAvailableCredits(String bookingId) {
        try {
            List<Credit_Note__c> credits = [
                SELECT Id, Name, Credit_Date__c,
                Credit_Amount__c, Available_Amount__c,
                Credit_Type__c, Credit_Reason__c, Auto_Apply__c, Priority__c,
                Payment_Schedule__r.Milestone_Name__c
                FROM Credit_Note__c
                WHERE Booking__c = :bookingId
                AND Status__c = 'Approved'
                AND Available_Amount__c > 0
                ORDER BY Priority__c ASC, Credit_Date__c ASC
            ];
            
            List<CreditNoteInfo> creditList = new List<CreditNoteInfo>();
            for (Credit_Note__c c : credits) {
                CreditNoteInfo info = new CreditNoteInfo();
                info.creditNoteId = c.Id;
                info.creditNoteNumber = c.Name;
                info.creditAmount = c.Credit_Amount__c;
                info.availableAmount = c.Available_Amount__c;
                info.creditType = c.Credit_Type__c;
                info.creditReason = c.Credit_Reason__c;
                info.autoApply = c.Auto_Apply__c;
                info.milestoneName = c.Payment_Schedule__r.Milestone_Name__c;
                info.formattedAmount = formatCurrency(c.Available_Amount__c);
                creditList.add(info);
            }
            
            return creditList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching credits: ' + e.getMessage());
        }
    }
    
    // ==================== GET AVAILABLE ADVANCES ====================
    
    @AuraEnabled(cacheable=true)
    public static List<AdvanceInfo> getAvailableAdvances(String bookingId) {
        try {
            List<Advance_Payment__c> advances = [
                SELECT Id, Name, Advance_Date__c,
                Advance_Amount__c, Available_Amount__c,
                Source_Receipt__r.Name
                FROM Advance_Payment__c
                WHERE Booking__c = :bookingId
                AND Available_Amount__c > 0
                ORDER BY Advance_Date__c ASC
            ];
            
            List<AdvanceInfo> advanceList = new List<AdvanceInfo>();
            for (Advance_Payment__c a : advances) {
                AdvanceInfo info = new AdvanceInfo();
                info.advanceId = a.Id;
                info.advanceNumber = a.Name;
                info.advanceAmount = a.Advance_Amount__c;
                info.availableAmount = a.Available_Amount__c;
                info.sourceReceiptNumber = a.Source_Receipt__r.Name;
                info.formattedAmount = formatCurrency(a.Available_Amount__c);
                advanceList.add(info);
            }
            
            return advanceList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching advances: ' + e.getMessage());
        }
    }
    
    // ==================== GET PICKLIST VALUES ====================
    
    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getPaymentModeOptions() {
        return getPicklistValues('Receipt__c', 'Payment_Mode__c');
    }
    
    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getBankOptions() {
        return getPicklistValues('Booking__c', 'Bank__c');
    }
    
    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getCreditTypeOptions() {
        return getPicklistValues('Credit_Note__c', 'Credit_Type__c');
    }
    
    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getDebitTypeOptions() {
        return getPicklistValues('Debit_Note__c', 'Debit_Type__c');
    }
    
    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getRefundReasonOptions() {
        return getPicklistValues('Refund__c', 'Refund_Reason__c');
    }
    
    private static List<PicklistOption> getPicklistValues(String objectName, String fieldName) {
        List<PicklistOption> options = new List<PicklistOption>();
        
        try {
            Schema.SObjectType objType = Schema.getGlobalDescribe().get(objectName);
            if (objType == null) return options;
            
            Schema.DescribeSObjectResult objDescribe = objType.getDescribe();
            Map<String, Schema.SObjectField> fieldMap = objDescribe.fields.getMap();
            
            if (!fieldMap.containsKey(fieldName)) return options;
            
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
            
            for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
                if (entry.isActive()) {
                    options.add(new PicklistOption(entry.getLabel(), entry.getValue()));
                }
            }
        } catch (Exception e) {
            System.debug('Error getting picklist values: ' + e.getMessage());
        }
        
        return options;
    }
    
    // ==================== CREATE RECEIPT ====================
    
    @AuraEnabled
    public static ReceiptResult createReceipt(String receiptData) {
        Savepoint sp = Database.setSavepoint();
        
        try {
            ReceiptWrapper wrapper = (ReceiptWrapper) JSON.deserialize(receiptData, ReceiptWrapper.class);
            
            // Validate duplicate transaction number
            Integer duplicateCount = [
                SELECT COUNT()
                FROM Receipt__c
                WHERE Transaction_Reference__c = :wrapper.transactionNumber
                AND Booking__c = :wrapper.bookingId
            ];
            
            if (duplicateCount > 0) {
                throw new AuraHandledException('Duplicate transaction number exists');
            }
            
            // Create Receipt
            Receipt__c receipt = new Receipt__c();
            receipt.Booking__c = wrapper.bookingId;
            receipt.Receipt_Date__c = wrapper.receiptDate;
            receipt.Amount_Received__c = wrapper.amountReceived;
            receipt.TDS_Deducted__c = wrapper.tdsAmount ?? 0;
            receipt.Payment_Method__c = wrapper.paymentMode;
            receipt.Payment_From__c = wrapper.paymentFrom;
            receipt.Bank_Name__c = wrapper.bankName;
            receipt.Transaction_Reference__c = wrapper.transactionNumber;
            receipt.Cheque_Date__c = wrapper.chequeDate;
            receipt.Remarks__c = wrapper.remarks;
            receipt.Approval_Status__c = 'Draft';
            
            insert receipt;
            
            Decimal remainingAmount = receipt.Total_Amount__c;
            List<Receipt_Line_Item__c> lineItems = new List<Receipt_Line_Item__c>();
            Integer sequence = 1;
            
            Decimal advanceUtilized = 0;
            Decimal creditApplied = 0;
            Decimal allocatedToDemands = 0;
            
            // Step 1: Utilize Advances (if enabled)
            if (wrapper.useAdvances) {
                List<Advance_Payment__c> advances = [
                    SELECT Id, Available_Amount__c
                    FROM Advance_Payment__c
                    WHERE Booking__c = :wrapper.bookingId
                    AND Available_Amount__c > 0
                    ORDER BY Advance_Date__c ASC
                ];
                
                List<Demands__c> openDemands = getOpenDemandsForAllocation(wrapper.bookingId);
                
                for (Advance_Payment__c advance : advances) {
                    if (openDemands.isEmpty()) break;
                    
                    Decimal advanceRemaining = advance.Available_Amount__c;
                    
                    for (Demands__c demand : openDemands) {
                        if (advanceRemaining <= 0) break;
                        if (demand.Pending_Amount__c <= 0) continue;
                        
                        Decimal allocated = Math.min(demand.Pending_Amount__c, advanceRemaining);
                        
                        lineItems.add(createLineItem(
                            receipt.Id, wrapper.bookingId, sequence++,
                            'Advance Utilization', 'Advance',
                            demand.Id, demand.Payment_Schedule__c,
                            advance.Id, null, allocated
                        ));
                        
                        demand.Pending_Amount__c -= allocated;
                        advanceRemaining -= allocated;
                        advanceUtilized += allocated;
                    }
                }
            }
            
            // Step 2: Apply Credits (if enabled)
            if (wrapper.useCredits) {
                List<Credit_Note__c> credits = [
                    SELECT Id, Available_Amount__c
                    FROM Credit_Note__c
                    WHERE Booking__c = :wrapper.bookingId
                    AND Available_Amount__c > 0
                    AND Status__c = 'Approved'
                    AND Auto_Apply__c = true
                    ORDER BY Priority__c ASC
                ];
                
                for (Credit_Note__c credit : credits) {
                    if (remainingAmount <= 0) break;
                    
                    Decimal allocated = Math.min(credit.Available_Amount__c, remainingAmount);
                    
                    lineItems.add(createLineItem(
                        receipt.Id, wrapper.bookingId, sequence++,
                        'Credit Adjustment', 'Credit',
                        null, null, null, credit.Id, allocated
                    ));
                    
                    remainingAmount -= allocated;
                    creditApplied += allocated;
                }
            }
            
            // Step 3: Allocate to Demands
            List<Demands__c> demandsForPayment = getOpenDemandsForAllocation(wrapper.bookingId);
            
            for (Demands__c demand : demandsForPayment) {
                if (remainingAmount <= 0) break;
                if (demand.Pending_Amount__c <= 0) continue;
                
                Decimal allocated = Math.min(demand.Pending_Amount__c, remainingAmount);
                
                lineItems.add(createLineItem(
                    receipt.Id, wrapper.bookingId, sequence++,
                    'Demand Payment', 'Principal',
                    demand.Id, demand.Payment_Schedule__c,
                    null, null, allocated
                ));
                
                remainingAmount -= allocated;
                allocatedToDemands += allocated;
            }
            
            // Step 4: Create Advance if Excess
            Decimal excessAmount = remainingAmount;
            Advance_Payment__c newAdvance;
            
            if (excessAmount > 0) {
                newAdvance = new Advance_Payment__c();
                newAdvance.Booking__c = wrapper.bookingId;
                newAdvance.Advance_Amount__c = excessAmount;
                newAdvance.Advance_Date__c = wrapper.receiptDate;
                newAdvance.Source_Receipt__c = receipt.Id;
                newAdvance.Auto_Utilize__c = true;
                newAdvance.Remarks__c = 'Excess payment from Receipt';
                
                insert newAdvance;
                
                receipt.New_Advance_Created__c = excessAmount;
                receipt.Created_Advance__c = newAdvance.Id;
            }
            
            // Insert all line items
            if (!lineItems.isEmpty()) {
                insert lineItems;
            }
            
            // Update receipt
            update receipt;
            
            // Prepare result
            ReceiptResult result = new ReceiptResult();
            result.receiptId = receipt.Id;
            result.receiptNumber = receipt.Name;
            result.success = true;
            result.message = 'Receipt created successfully. Pending approval.';
            result.advanceUtilized = advanceUtilized;
            result.creditApplied = creditApplied;
            result.allocatedToDemands = allocatedToDemands;
            result.excessAmount = excessAmount;
            result.newAdvanceId = newAdvance?.Id;
            result.lineItemCount = lineItems.size();
            
            return result;
            
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error creating receipt: ' + e.getMessage());
        }
    }
    
    // ==================== CREATE CREDIT NOTE ====================
    
    @AuraEnabled
    public static String createCreditNote(String creditNoteData) {
        Savepoint sp = Database.setSavepoint();
        
        try {
            CreditNoteWrapper wrapper = (CreditNoteWrapper) JSON.deserialize(
                creditNoteData, CreditNoteWrapper.class
            );
            
            Credit_Note__c creditNote = new Credit_Note__c();
            creditNote.Booking__c = wrapper.bookingId;
            creditNote.Credit_Date__c = wrapper.creditDate;
            creditNote.Credit_Amount__c = wrapper.creditAmount;
            creditNote.Credit_Type__c = wrapper.creditType;
            creditNote.Credit_Reason__c = wrapper.creditReason;
            creditNote.Description__c = wrapper.description;
            creditNote.Apply_To__c = wrapper.applyTo;
            creditNote.Payment_Schedule__c = wrapper.paymentScheduleId;
            creditNote.Auto_Apply__c = wrapper.autoApply;
            creditNote.Priority__c = wrapper.priority ?? 5;
            creditNote.Status__c = 'Pending';
            
            insert creditNote;
            
            return creditNote.Id;
            
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error creating credit note: ' + e.getMessage());
        }
    }
    
    // ==================== CREATE DEBIT NOTE ====================
    
    @AuraEnabled
    public static String createDebitNote(String debitNoteData) {
        Savepoint sp = Database.setSavepoint();
        
        try {
            DebitNoteWrapper wrapper = (DebitNoteWrapper) JSON.deserialize(
                debitNoteData, DebitNoteWrapper.class
            );
            
            Debit_Note__c debitNote = new Debit_Note__c();
            debitNote.Booking__c = wrapper.bookingId;
            debitNote.Debit_Date__c = wrapper.debitDate;
            debitNote.Debit_Amount__c = wrapper.debitAmount;
            debitNote.Debit_Type__c = wrapper.debitType;
            debitNote.Debit_Reason__c = wrapper.debitReason;
            debitNote.Description__c = wrapper.description;
            debitNote.Debit_Type__c = wrapper.chargeAgainst;
            debitNote.Payment_Schedule__c = wrapper.paymentScheduleId;
            debitNote.Auto_Create_Demand__c = wrapper.autoCreateDemand;
            debitNote.Status__c = 'Pending';
            
            insert debitNote;
            
            return debitNote.Id;
            
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error creating debit note: ' + e.getMessage());
        }
    }
    
    // ==================== CREATE REFUND ====================
    
    @AuraEnabled
    public static String createRefund(String refundData) {
        Savepoint sp = Database.setSavepoint();
        
        try {
            RefundWrapper wrapper = (RefundWrapper) JSON.deserialize(
                refundData, RefundWrapper.class
            );
            
            // Validate refund amount
            Decimal maxRefund = getMaxRefundableAmount(wrapper.bookingId);
            if (wrapper.refundAmount > maxRefund) {
                throw new AuraHandledException(
                    'Refund amount cannot exceed available balance of ₹' + 
                    String.valueOf(maxRefund.setScale(2))
                );
            }
            
            Refund__c refund = new Refund__c();
            refund.Booking__c = wrapper.bookingId;
            refund.Refund_Date__c = wrapper.refundDate;
            refund.Refund_Amount__c = wrapper.refundAmount;
            refund.Refund_Reason__c = wrapper.refundReason;
            refund.Refund_Mode__c = wrapper.refundMode;
            refund.Bank_Name__c = wrapper.bankName;
            refund.Transaction_Reference__c = wrapper.transactionReference;
            refund.Description__c = wrapper.description;
            refund.Status__c = 'Pending';
            
            insert refund;
            
            return refund.Id;
            
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error creating refund: ' + e.getMessage());
        }
    }
    
    // ==================== HELPER METHODS ====================
    
    private static List<Demands__c> getOpenDemandsForAllocation(Id bookingId) {
        // Query all open demands
        List<Demands__c> allDemands = [
            SELECT Id, Name, Pending_Amount__c,
            Payment_Schedule__c, Demand_Type__c, Status__c, Due_Date__c
            FROM Demands__c
            WHERE Booking__c = :bookingId
            AND Status__c IN ('Open', 'Partial')
            AND Pending_Amount__c > 0
            ORDER BY Due_Date__c ASC
        ];
        
        // Sort by priority in memory
        List<Demands__c> interestDemands = new List<Demands__c>();
        List<Demands__c> debitNoteDemands = new List<Demands__c>();
        List<Demands__c> otherDemands = new List<Demands__c>();
        
        for (Demands__c d : allDemands) {
            if (d.Demand_Type__c == 'Interest') {
                interestDemands.add(d);
            } else if (d.Demand_Type__c == 'Debit Note') {
                debitNoteDemands.add(d);
            } else {
                otherDemands.add(d);
            }
        }
        
        // Combine in priority order
        List<Demands__c> sortedDemands = new List<Demands__c>();
        sortedDemands.addAll(interestDemands);
        sortedDemands.addAll(debitNoteDemands);
        sortedDemands.addAll(otherDemands);
        
        return sortedDemands;
    }
    
    private static Receipt_Line_Item__c createLineItem(
        Id receiptId, Id bookingId, Integer sequence,
        String allocationType, String lineItemType,
        Id demandId, Id scheduleId, Id advanceId, Id creditId,
        Decimal amount
    ) {
        Receipt_Line_Item__c item = new Receipt_Line_Item__c();
        item.Receipt__c = receiptId;
        item.Booking__c = bookingId;
        item.Sequence__c = sequence;
        item.Allocation_Type__c = allocationType;
        item.Line_Item_Type__c = lineItemType;
        item.Demand__c = demandId;
        item.Payment_Schedule__c = scheduleId;
        item.Advance_Payment__c = advanceId;
        item.Credit_Note__c = creditId;
        item.Allocated_Amount__c = amount;
        return item;
    }
    
    private static Decimal getMaxRefundableAmount(Id bookingId) {
        BookingSummary summary = getBookingSummary(bookingId);
        return summary.advancePaymentAvailable;
    }
    
    
    @AuraEnabled(cacheable=true)
    public static List<TransactionHistoryItem> getTransactionHistory(String bookingId, String transactionType) {
        try {
            List<TransactionHistoryItem> historyItems = new List<TransactionHistoryItem>();
            
            if (transactionType == 'receipt') {
                List<Receipt__c> receipts = [
                    SELECT Id, Name, Receipt_Date__c, Amount_Received__c, Approval_Status__c
                    FROM Receipt__c
                    WHERE Booking__c = :bookingId
                    ORDER BY Receipt_Date__c DESC
                    LIMIT 10
                ];
                
                for (Receipt__c r : receipts) {
                    TransactionHistoryItem item = new TransactionHistoryItem();
                    item.id = r.Id;
                    item.number_x = r.Name;
                    item.transactionDate = r.Receipt_Date__c;
                    item.amount = r.Amount_Received__c;
                    item.status = mapApprovalStatus(r.Approval_Status__c);
                    historyItems.add(item);
                }
            } else if (transactionType == 'credit') {
                List<Credit_Note__c> credits = [
                    SELECT Id, Name, Credit_Date__c, Credit_Amount__c, Status__c
                    FROM Credit_Note__c
                    WHERE Booking__c = :bookingId
                    ORDER BY Credit_Date__c DESC
                    LIMIT 10
                ];
                
                for (Credit_Note__c c : credits) {
                    TransactionHistoryItem item = new TransactionHistoryItem();
                    item.id = c.Id;
                    item.number_x = c.Name;
                    item.transactionDate = c.Credit_Date__c;
                    item.amount = c.Credit_Amount__c;
                    item.status = mapApprovalStatus(c.Status__c);
                    historyItems.add(item);
                }
            } else if (transactionType == 'debit') {
                List<Debit_Note__c> debits = [
                    SELECT Id, Name, Debit_Date__c, Debit_Amount__c, Status__c
                    FROM Debit_Note__c
                    WHERE Booking__c = :bookingId
                    ORDER BY Debit_Date__c DESC
                    LIMIT 10
                ];
                
                for (Debit_Note__c d : debits) {
                    TransactionHistoryItem item = new TransactionHistoryItem();
                    item.id = d.Id;
                    item.number_x = d.Name;
                    item.transactionDate = d.Debit_Date__c;
                    item.amount = d.Debit_Amount__c;
                    item.status = mapApprovalStatus(d.Status__c);
                    historyItems.add(item);
                }
            } else if (transactionType == 'refund') {
                List<Refund__c> refunds = [
                    SELECT Id, Name, Refund_Date__c, Refund_Amount__c, Status__c
                    FROM Refund__c
                    WHERE Booking__c = :bookingId
                    ORDER BY Refund_Date__c DESC
                    LIMIT 10
                ];
                
                for (Refund__c r : refunds) {
                    TransactionHistoryItem item = new TransactionHistoryItem();
                    item.id = r.Id;
                    item.number_x = r.Name;
                    item.transactionDate = r.Refund_Date__c;
                    item.amount = r.Refund_Amount__c;
                    item.status = mapApprovalStatus(r.Status__c);
                    historyItems.add(item);
                }
            }
            
            return historyItems;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching transaction history: ' + e.getMessage());
        }
    }
    
    // ==================== NEW HELPER METHOD: MAP APPROVAL STATUS ====================
    
    private static String mapApprovalStatus(String status) {
        if (status == null) return 'Draft';
        
        Map<String, String> statusMap = new Map<String, String>{
            'Draft' => 'Draft',
                'Pending' => 'Pending',
                'Pending Approval' => 'Pending',
                'Approved' => 'Approved',
                'Rejected' => 'Rejected',
                'Cancelled' => 'Rejected'
                };
                    
                    return statusMap.containsKey(status) ? statusMap.get(status) : status;
    }
    
    // ==================== NEW HELPER METHOD: FORMAT CURRENCY ====================
    
    private static String formatCurrency(Decimal amount) {
        if (amount == null) return '₹ 0';
        return '₹ ' + String.valueOf(amount.setScale(0).format());
    }
    
    
    
    
    // ==================== WRAPPER CLASSES ====================
    
    
    public class TransactionHistoryItem {
        @AuraEnabled public Id id;
        @AuraEnabled public String number_x { get; set; }
        @AuraEnabled public Date transactionDate;
        @AuraEnabled public Decimal amount;
        @AuraEnabled public String status;
    }
    
    
    public class BookingSummary {
        @AuraEnabled public Id bookingId;
        @AuraEnabled public String bookingName;
        @AuraEnabled public String projectName;
        @AuraEnabled public String unitNumber;
        @AuraEnabled public Decimal originalAgreementValue;
        @AuraEnabled public Decimal totalCreditNotes;
        @AuraEnabled public Decimal totalDebitNotes;
        @AuraEnabled public Decimal netAgreementValue;
        @AuraEnabled public Decimal totalDemandRaised;
        @AuraEnabled public Decimal totalReceiptAmount;
        @AuraEnabled public Decimal outstandingDemandAmount;
        @AuraEnabled public Decimal advancePaymentAvailable;
        @AuraEnabled public Decimal currentPayableBalance;
        @AuraEnabled public Decimal futureDemandBalance;
        @AuraEnabled public String bookingStatus;
        @AuraEnabled public String paymentStatus;
    }
    
    public class DemandInfo {
        @AuraEnabled public Id demandId;
        @AuraEnabled public String demandNumber;
        @AuraEnabled public String milestoneName;
        @AuraEnabled public Date demandDate;
        @AuraEnabled public Date dueDate;
        @AuraEnabled public Decimal totalDemandAmount;
        @AuraEnabled public Decimal pendingAmount;
        @AuraEnabled public String demandType;
        @AuraEnabled public String status;
        @AuraEnabled public Integer daysOverdue;
        @AuraEnabled public Boolean isOverdue;
    }
    
    public class CreditNoteInfo {
        @AuraEnabled public Id creditNoteId;
        @AuraEnabled public String creditNoteNumber;
        @AuraEnabled public Decimal creditAmount;
        @AuraEnabled public Decimal availableAmount;
        @AuraEnabled public String creditType;
        @AuraEnabled public String creditReason;
        @AuraEnabled public Boolean autoApply;
        @AuraEnabled public String milestoneName;
        @AuraEnabled public String formattedAmount;
    }
    
    public class AdvanceInfo {
        @AuraEnabled public Id advanceId;
        @AuraEnabled public String advanceNumber;
        @AuraEnabled public Decimal advanceAmount;
        @AuraEnabled public Decimal availableAmount;
        @AuraEnabled public String sourceReceiptNumber;
        @AuraEnabled public String formattedAmount;
    }
    
    public class PicklistOption {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        
        public PicklistOption(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }
    
    public class ReceiptWrapper {
        public Id bookingId;
        public Date receiptDate;
        public Decimal amountReceived;
        public Decimal tdsAmount;
        public String paymentMode;
        public String paymentFrom;
        public String bankName;
        public String transactionNumber;
        public Date chequeDate;
        public String remarks;
        public Boolean useAdvances;
        public Boolean useCredits;
    }
    
    public class ReceiptResult {
        @AuraEnabled public Id receiptId;
        @AuraEnabled public String receiptNumber;
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public Decimal advanceUtilized;
        @AuraEnabled public Decimal creditApplied;
        @AuraEnabled public Decimal allocatedToDemands;
        @AuraEnabled public Decimal excessAmount;
        @AuraEnabled public Id newAdvanceId;
        @AuraEnabled public Integer lineItemCount;
    }
    
    public class CreditNoteWrapper {
        public Id bookingId;
        public Date creditDate;
        public Decimal creditAmount;
        public String creditType;
        public String creditReason;
        public String description;
        public String applyTo;
        public Id paymentScheduleId;
        public Boolean autoApply;
        public Integer priority;
    }
    
    public class DebitNoteWrapper {
        public Id bookingId;
        public Date debitDate;
        public Decimal debitAmount;
        public String debitType;
        public String debitReason;
        public String description;
        public String chargeAgainst;
        public Id paymentScheduleId;
        public Boolean autoCreateDemand;
    }
    
    public class RefundWrapper {
        public Id bookingId;
        public Date refundDate;
        public Decimal refundAmount;
        public String refundReason;
        public String refundMode;
        public String bankName;
        public String transactionReference;
        public String description;
    }
}