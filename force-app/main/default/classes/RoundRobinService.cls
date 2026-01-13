public with sharing class RoundRobinService {
    
    /**
     * Main entry point for assigning leads
     */
    public static void assignLeads(List<Lead__c> leads) {
        // Fetch all active buckets and their categorized members
        List<Round_Robin__c> buckets = [SELECT Id, Project__c, Zone__c, Source__c, Customer_Type__c, 
                                        Last_Index_Pre_Sales__c, Last_Index_Sales__c, 
                                        Last_Index_CP__c, Last_Index_Post_Sales__c,
                                        (SELECT Id, User__c, Assignment_Type__c FROM Round_Robin_Members__r 
                                         WHERE Is_Active__c = true ORDER BY Order__c ASC)
                                        FROM Round_Robin__c WHERE Is_Active__c = true];

        List<Round_Robin__c> bucketsToUpdate = new List<Round_Robin__c>();
        
        for (Lead__c ld : leads) {
            Round_Robin__c bestMatch = findBestBucket(ld, buckets);

            if (bestMatch != null) {
                // Determine which group to rotate based on lead's Assignment Type
                String leadType = ''; //ld.Assignment_Type__c 
                
                List<Round_Robin_Member__c> groupMembers = new List<Round_Robin_Member__c>();
                for(Round_Robin_Member__c m : bestMatch.Round_Robin_Members__r) {
                    if(m.Assignment_Type__c == leadType) groupMembers.add(m);
                }

                if (!groupMembers.isEmpty()) {
                    String fieldName = getIndexFieldName(leadType);
                    Integer lastIdx = (bestMatch.get(fieldName) == null) ? -1 : Integer.valueOf(bestMatch.get(fieldName));
                    Integer nextIdx = Math.mod(lastIdx + 1, groupMembers.size());
                    
                    ld.OwnerId = groupMembers[nextIdx].User__c;
                    bestMatch.put(fieldName, nextIdx);
                    bucketsToUpdate.add(bestMatch);
                }
            }
        }
        
        if(!bucketsToUpdate.isEmpty()) {
            // Use a Set to avoid "Duplicate ID in List" if multiple leads match one bucket in the same transaction
            update new List<Round_Robin__c>(new Set<Round_Robin__c>(bucketsToUpdate));
        }
    }

    private static Round_Robin__c findBestBucket(Lead__c ld, List<Round_Robin__c> buckets) {
        Round_Robin__c selected = null;
        Integer maxScore = -1;

        for (Round_Robin__c b : buckets) {
            Integer score = 0;
            // Check Matching Criteria
            Boolean pMatch = (b.Project__c == null || b.Project__c == ld.Project__c);
            Boolean zMatch = (String.isBlank(b.Zone__c) || b.Zone__c == ld.Zone__c);
            Boolean sMatch = (String.isBlank(b.Source__c) || b.Source__c == ld.Lead_Source__c);
            Boolean cMatch = (b.Customer_Type__c == 'Both' || b.Customer_Type__c == ld.Customer_Type__c);

            if (pMatch && zMatch && sMatch && cMatch) {
                if(b.Project__c != null) score += 1000;
                if(String.isNotBlank(b.Zone__c)) score += 100;
                if(String.isNotBlank(b.Source__c)) score += 10;
                if(b.Customer_Type__c != 'Both') score += 1;

                if (score > maxScore) {
                    maxScore = score;
                    selected = b;
                }
            }
        }
        return selected;
    }

    private static String getIndexFieldName(String type) {
        if(type == 'Pre-Sales') return 'Last_Index_Pre_Sales__c';
        if(type == 'Sales') return 'Last_Index_Sales__c';
        if(type == 'Channel Partner') return 'Last_Index_CP__c';
        return 'Last_Index_Post_Sales__c';
    }
}