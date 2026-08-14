export interface CampaignTaskParticipantRequest {
  headers: {
    authorization?: string;
    "x-tenant-id"?: string;
    "x-participant-id"?: string;
    "idempotency-key"?: string;
  };
  participantContext?: {
    tenantId: string;
    participantId: string;
  };
}
