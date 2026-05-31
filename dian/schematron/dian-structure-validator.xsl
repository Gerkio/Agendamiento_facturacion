<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xsl:stylesheet xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                xmlns:saxon="http://saxon.sf.net/"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:schold="http://www.ascc.net/xml/schematron"
                xmlns:iso="http://purl.oclc.org/dsdl/schematron"
                xmlns:xhtml="http://www.w3.org/1999/xhtml"
                xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
                xmlns:cn="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
                xmlns:dn="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2"
                xmlns:app="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
                xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
                xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
                xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDataTypes-2"
                xmlns:udt="urn:oasis:names:specification:ubl:schema:xsd:UnqualifiedDataTypes-2"
                xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
                xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
                xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#"
                version="2.0"><!--Implementers: please note that overriding process-prolog or process-root is 
    the preferred method for meta-stylesheets to use where possible. -->
   <xsl:param name="archiveDirParameter"/>
   <xsl:param name="archiveNameParameter"/>
   <xsl:param name="fileNameParameter"/>
   <xsl:param name="fileDirParameter"/>
   <xsl:variable name="document-uri">
      <xsl:value-of select="document-uri(/)"/>
   </xsl:variable>
   <!--PHASES-->
   <!--PROLOG-->
   <xsl:output xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
               method="xml"
               omit-xml-declaration="no"
               standalone="yes"
               indent="yes"/>
   <!--XSD TYPES FOR XSLT2-->
   <!--KEYS AND FUNCTIONS-->
   <!--DEFAULT RULES-->
   <!--MODE: SCHEMATRON-SELECT-FULL-PATH-->
   <!--This mode can be used to generate an ugly though full XPath for locators-->
   <xsl:template match="*" mode="schematron-select-full-path">
      <xsl:apply-templates select="." mode="schematron-get-full-path"/>
   </xsl:template>
   <!--MODE: SCHEMATRON-FULL-PATH-->
   <!--This mode can be used to generate an ugly though full XPath for locators-->
   <xsl:template match="*" mode="schematron-get-full-path">
      <xsl:apply-templates select="parent::*" mode="schematron-get-full-path"/>
      <xsl:text>/</xsl:text>
      <xsl:choose>
         <xsl:when test="namespace-uri()=''">
            <xsl:value-of select="name()"/>
         </xsl:when>
         <xsl:otherwise>
            <xsl:text>*:</xsl:text>
            <xsl:value-of select="local-name()"/>
            <xsl:text>[namespace-uri()='</xsl:text>
            <xsl:value-of select="namespace-uri()"/>
            <xsl:text>']</xsl:text>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:variable name="preceding"
                    select="count(preceding-sibling::*[local-name()=local-name(current())                                   and namespace-uri() = namespace-uri(current())])"/>
      <xsl:text>[</xsl:text>
      <xsl:value-of select="1+ $preceding"/>
      <xsl:text>]</xsl:text>
   </xsl:template>
   <xsl:template match="@*" mode="schematron-get-full-path">
      <xsl:apply-templates select="parent::*" mode="schematron-get-full-path"/>
      <xsl:text>/</xsl:text>
      <xsl:choose>
         <xsl:when test="namespace-uri()=''">@<xsl:value-of select="name()"/>
         </xsl:when>
         <xsl:otherwise>
            <xsl:text>@*[local-name()='</xsl:text>
            <xsl:value-of select="local-name()"/>
            <xsl:text>' and namespace-uri()='</xsl:text>
            <xsl:value-of select="namespace-uri()"/>
            <xsl:text>']</xsl:text>
         </xsl:otherwise>
      </xsl:choose>
   </xsl:template>
   <!--MODE: SCHEMATRON-FULL-PATH-2-->
   <!--This mode can be used to generate prefixed XPath for humans-->
   <xsl:template match="node() | @*" mode="schematron-get-full-path-2">
      <xsl:for-each select="ancestor-or-self::*">
         <xsl:text>/</xsl:text>
         <xsl:value-of select="name(.)"/>
         <xsl:if test="preceding-sibling::*[name(.)=name(current())]">
            <xsl:text>[</xsl:text>
            <xsl:value-of select="count(preceding-sibling::*[name(.)=name(current())])+1"/>
            <xsl:text>]</xsl:text>
         </xsl:if>
      </xsl:for-each>
      <xsl:if test="not(self::*)">
         <xsl:text/>/@<xsl:value-of select="name(.)"/>
      </xsl:if>
   </xsl:template>
   <!--MODE: SCHEMATRON-FULL-PATH-3-->
   <!--This mode can be used to generate prefixed XPath for humans 
	(Top-level element has index)-->
   <xsl:template match="node() | @*" mode="schematron-get-full-path-3">
      <xsl:for-each select="ancestor-or-self::*">
         <xsl:text>/</xsl:text>
         <xsl:value-of select="name(.)"/>
         <xsl:if test="parent::*">
            <xsl:text>[</xsl:text>
            <xsl:value-of select="count(preceding-sibling::*[name(.)=name(current())])+1"/>
            <xsl:text>]</xsl:text>
         </xsl:if>
      </xsl:for-each>
      <xsl:if test="not(self::*)">
         <xsl:text/>/@<xsl:value-of select="name(.)"/>
      </xsl:if>
   </xsl:template>
   <!--MODE: GENERATE-ID-FROM-PATH -->
   <xsl:template match="/" mode="generate-id-from-path"/>
   <xsl:template match="text()" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.text-', 1+count(preceding-sibling::text()), '-')"/>
   </xsl:template>
   <xsl:template match="comment()" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.comment-', 1+count(preceding-sibling::comment()), '-')"/>
   </xsl:template>
   <xsl:template match="processing-instruction()" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.processing-instruction-', 1+count(preceding-sibling::processing-instruction()), '-')"/>
   </xsl:template>
   <xsl:template match="@*" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.@', name())"/>
   </xsl:template>
   <xsl:template match="*" mode="generate-id-from-path" priority="-0.5">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:text>.</xsl:text>
      <xsl:value-of select="concat('.',name(),'-',1+count(preceding-sibling::*[name()=name(current())]),'-')"/>
   </xsl:template>
   <!--MODE: GENERATE-ID-2 -->
   <xsl:template match="/" mode="generate-id-2">U</xsl:template>
   <xsl:template match="*" mode="generate-id-2" priority="2">
      <xsl:text>U</xsl:text>
      <xsl:number level="multiple" count="*"/>
   </xsl:template>
   <xsl:template match="node()" mode="generate-id-2">
      <xsl:text>U.</xsl:text>
      <xsl:number level="multiple" count="*"/>
      <xsl:text>n</xsl:text>
      <xsl:number count="node()"/>
   </xsl:template>
   <xsl:template match="@*" mode="generate-id-2">
      <xsl:text>U.</xsl:text>
      <xsl:number level="multiple" count="*"/>
      <xsl:text>_</xsl:text>
      <xsl:value-of select="string-length(local-name(.))"/>
      <xsl:text>_</xsl:text>
      <xsl:value-of select="translate(name(),':','.')"/>
   </xsl:template>
   <!--Strip characters-->
   <xsl:template match="text()" priority="-1"/>
   <!--SCHEMA SETUP-->
   <xsl:template match="/">
      <svrl:schematron-output xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                              title="DIAN UBL2.1 Reglas de Validación"
                              schemaVersion="">
         <xsl:comment>
            <xsl:value-of select="$archiveDirParameter"/>   
		 <xsl:value-of select="$archiveNameParameter"/>  
		 <xsl:value-of select="$fileNameParameter"/>  
		 <xsl:value-of select="$fileDirParameter"/>
         </xsl:comment>
         <svrl:ns-prefix-in-attribute-values uri="http://www.w3.org/2001/XMLSchema" prefix="xs"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
                                             prefix="ubl"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
                                             prefix="cn"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2"
                                             prefix="dn"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
                                             prefix="app"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
                                             prefix="ext"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
                                             prefix="cbc"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                                             prefix="cac"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDataTypes-2"
                                             prefix="qdt"/>
         <svrl:ns-prefix-in-attribute-values uri="urn:oasis:names:specification:ubl:schema:xsd:UnqualifiedDataTypes-2"
                                             prefix="udt"/>
         <svrl:ns-prefix-in-attribute-values uri="dian:gov:co:facturaelectronica:Structures-2-1" prefix="sts"/>
         <svrl:ns-prefix-in-attribute-values uri="http://www.w3.org/2000/09/xmldsig#" prefix="ds"/>
         <svrl:ns-prefix-in-attribute-values uri="http://uri.etsi.org/01903/v1.3.2#" prefix="xades"/>
         <svrl:ns-prefix-in-attribute-values uri="http://uri.etsi.org/01903/v1.4.1#" prefix="xades141"/>
         <svrl:active-pattern>
            <xsl:attribute name="document">
               <xsl:value-of select="document-uri(/)"/>
            </xsl:attribute>
            <xsl:attribute name="id">UBL21-structure1</xsl:attribute>
            <xsl:attribute name="name">UBL21-structure1</xsl:attribute>
            <xsl:apply-templates/>
         </svrl:active-pattern>
         <xsl:apply-templates select="/" mode="M18"/>
         <svrl:active-pattern>
            <xsl:attribute name="document">
               <xsl:value-of select="document-uri(/)"/>
            </xsl:attribute>
            <xsl:attribute name="id">UBL21-structure2</xsl:attribute>
            <xsl:attribute name="name">UBL21-structure2</xsl:attribute>
            <xsl:apply-templates/>
         </svrl:active-pattern>
         <xsl:apply-templates select="/" mode="M19"/>
         <svrl:active-pattern>
            <xsl:attribute name="document">
               <xsl:value-of select="document-uri(/)"/>
            </xsl:attribute>
            <xsl:attribute name="id">UBL21-structure3</xsl:attribute>
            <xsl:attribute name="name">UBL21-structure3</xsl:attribute>
            <xsl:apply-templates/>
         </svrl:active-pattern>
         <xsl:apply-templates select="/" mode="M20"/>
         <svrl:active-pattern>
            <xsl:attribute name="document">
               <xsl:value-of select="document-uri(/)"/>
            </xsl:attribute>
            <xsl:attribute name="id">UBL-model</xsl:attribute>
            <xsl:attribute name="name">UBL-model</xsl:attribute>
            <xsl:apply-templates/>
         </svrl:active-pattern>
         <xsl:apply-templates select="/" mode="M21"/>
      </svrl:schematron-output>
   </xsl:template>
   <!--SCHEMATRON PATTERNS-->
   <svrl:text xmlns:svrl="http://purl.oclc.org/dsdl/svrl">DIAN UBL2.1 Reglas de Validación</svrl:text>
   <!--PATTERN UBL21-structure1-->
   <!--RULE -->
   <xsl:template match="ext:*[* except ext:*]//*" priority="1001" mode="M18">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="ext:*[* except ext:*]//*"/>
      <xsl:apply-templates select="*" mode="M18"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="*[not(*)]" priority="1000" mode="M18">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl" context="*[not(*)]"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="normalize-space(.)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="normalize-space(.)">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>La regla UBL [IND5] indica que un elemento no puede estar vacío de contenido. </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M18"/>
   </xsl:template>
   <xsl:template match="text()" priority="-1" mode="M18"/>
   <xsl:template match="@*|node()" priority="-2" mode="M18">
      <xsl:apply-templates select="*" mode="M18"/>
   </xsl:template>
   <!--PATTERN UBL21-structure2-->
   <!--RULE -->
   <xsl:template match="@*[normalize-space(.) = '']" priority="1000" mode="M19">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="@*[normalize-space(.) = '']"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="normalize-space(.)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="normalize-space(.)">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>La regla UBL [IND5] indica que un atributo no puede estar vacio. </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M19"/>
   </xsl:template>
   <xsl:template match="text()" priority="-1" mode="M19"/>
   <xsl:template match="@*|node()" priority="-2" mode="M19">
      <xsl:apply-templates select="*" mode="M19"/>
   </xsl:template>
   <!--PATTERN UBL21-structure3-->
   <!--RULE -->
   <xsl:template match="*[@languageID]" priority="1001" mode="M20">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl" context="*[@languageID]"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="not(../(* except current())[name(.) = name(current())][string(@languageID) = string(current()/@languageID)])"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="not(../(* except current())[name(.) = name(current())][string(@languageID) = string(current()/@languageID)])">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>La regla UBL [IND7] indica que dos elemento hermanos no pueden llevar en el atributo languageID= el mismo valor </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M20"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cbc:AcceptedVariantsDescription | cbc:AccountingCost | cbc:ActivityType | cbc:AdditionalConditions | cbc:AdditionalInformation | cbc:AgencyName | cbc:AllowanceChargeReason | cbc:ApprovalStatus | cbc:AwardingCriterionDescription | cbc:BackorderReason | cbc:BirthplaceName | cbc:BuildingNumber | cbc:CalculationExpression | cbc:CandidateStatement | cbc:CanonicalizationMethod | cbc:CarrierServiceInstructions | cbc:CertificateType | cbc:ChangeConditions | cbc:Channel | cbc:Characteristics | cbc:CodeValue | cbc:Comment | cbc:CompanyLegalForm | cbc:Condition | cbc:Conditions | cbc:ConditionsDescription | cbc:ConsumersEnergyLevel | cbc:ConsumptionLevel | cbc:ConsumptionType | cbc:Content | cbc:ContractSubdivision | cbc:ContractType | cbc:CorrectionType | cbc:CountrySubentity | cbc:CurrentChargeType | cbc:CustomerReference | cbc:CustomsClearanceServiceInstructions | cbc:DamageRemarks | cbc:DataSendingCapability | cbc:DeliveryInstructions | cbc:DemurrageInstructions | cbc:Department | cbc:Description | cbc:District | cbc:DocumentDescription | cbc:DocumentHash | cbc:DocumentType | cbc:Duty | cbc:ElectronicDeviceDescription | cbc:ElectronicMail | cbc:ExclusionReason | cbc:ExemptionReason | cbc:Expression | cbc:Extension | cbc:FeeDescription | cbc:Floor | cbc:ForwarderServiceInstructions | cbc:Frequency | cbc:FundingProgram | cbc:HandlingInstructions | cbc:HashAlgorithmMethod | cbc:HaulageInstructions | cbc:HeatingType | cbc:Information | cbc:InhouseMail | cbc:InstructionNote | cbc:Instructions | cbc:InvoicingPartyReference | cbc:JobTitle | cbc:Justification | cbc:JustificationDescription | cbc:Keyword | cbc:LatestMeterReadingMethod | cbc:LegalReference | cbc:LimitationDescription | cbc:Line | cbc:ListValue | cbc:Location | cbc:Login | cbc:LossRisk | cbc:LowTendersDescription | cbc:MarkAttention | cbc:MarkCare | cbc:MaximumValue | cbc:MeterConstant | cbc:MeterName | cbc:MeterNumber | cbc:MeterReadingComments | cbc:MeterReadingType | cbc:MinimumImprovementBid | cbc:MinimumValue | cbc:MonetaryScope | cbc:MovieTitle | cbc:NameSuffix | cbc:NegotiationDescription | cbc:Note | cbc:OneTimeChargeType | cbc:OptionsDescription | cbc:OrderableUnit | cbc:OrganizationDepartment | cbc:OutstandingReason | cbc:PackingMaterial | cbc:PartyType | cbc:Password | cbc:PayPerView | cbc:PaymentDescription | cbc:PaymentNote | cbc:PersonalSituation | cbc:PhoneNumber | cbc:PlacardEndorsement | cbc:PlacardNotation | cbc:PlotIdentification | cbc:PostalZone | cbc:Postbox | cbc:PreviousMeterReadingMethod | cbc:PriceChangeReason | cbc:PriceRevisionFormulaDescription | cbc:PriceType | cbc:PrintQualifier | cbc:Priority | cbc:PrizeDescription | cbc:ProcessDescription | cbc:ProcessReason | cbc:Rank | cbc:Reference | cbc:Region | cbc:RegistrationNationality | cbc:RejectReason | cbc:Remarks | cbc:ReplenishmentOwnerDescription | cbc:ResidenceType | cbc:Resolution | cbc:RoleDescription | cbc:Room | cbc:SealingPartyType | cbc:ServiceNumberCalled | cbc:ServiceType | cbc:ShippingMarks | cbc:ShipsRequirements | cbc:SignatureMethod | cbc:SpecialInstructions | cbc:SpecialServiceInstructions | cbc:SpecialTerms | cbc:SpecialTransportRequirements | cbc:StatusReason | cbc:SubscriberType | cbc:SummaryDescription | cbc:TariffDescription | cbc:TaxExemptionReason | cbc:TechnicalCommitteeDescription | cbc:TelecommunicationsServiceCall | cbc:TelecommunicationsServiceCategory | cbc:TelecommunicationsSupplyType | cbc:Telefax | cbc:Telephone | cbc:TestMethod | cbc:Text | cbc:TierRange | cbc:TimeAmount | cbc:TimezoneOffset | cbc:TimingComplaint | cbc:Title | cbc:TradingRestrictions | cbc:TransportServiceProviderSpecialTerms | cbc:TransportUserSpecialTerms | cbc:TransportationServiceDescription | cbc:ValidateProcess | cbc:ValidateTool | cbc:ValidateToolVersion | cbc:Value | cbc:ValueQualifier | cbc:WarrantyInformation | cbc:Weight | cbc:WorkPhase | cbc:XPath"
                 priority="1000"
                 mode="M20">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cbc:AcceptedVariantsDescription | cbc:AccountingCost | cbc:ActivityType | cbc:AdditionalConditions | cbc:AdditionalInformation | cbc:AgencyName | cbc:AllowanceChargeReason | cbc:ApprovalStatus | cbc:AwardingCriterionDescription | cbc:BackorderReason | cbc:BirthplaceName | cbc:BuildingNumber | cbc:CalculationExpression | cbc:CandidateStatement | cbc:CanonicalizationMethod | cbc:CarrierServiceInstructions | cbc:CertificateType | cbc:ChangeConditions | cbc:Channel | cbc:Characteristics | cbc:CodeValue | cbc:Comment | cbc:CompanyLegalForm | cbc:Condition | cbc:Conditions | cbc:ConditionsDescription | cbc:ConsumersEnergyLevel | cbc:ConsumptionLevel | cbc:ConsumptionType | cbc:Content | cbc:ContractSubdivision | cbc:ContractType | cbc:CorrectionType | cbc:CountrySubentity | cbc:CurrentChargeType | cbc:CustomerReference | cbc:CustomsClearanceServiceInstructions | cbc:DamageRemarks | cbc:DataSendingCapability | cbc:DeliveryInstructions | cbc:DemurrageInstructions | cbc:Department | cbc:Description | cbc:District | cbc:DocumentDescription | cbc:DocumentHash | cbc:DocumentType | cbc:Duty | cbc:ElectronicDeviceDescription | cbc:ElectronicMail | cbc:ExclusionReason | cbc:ExemptionReason | cbc:Expression | cbc:Extension | cbc:FeeDescription | cbc:Floor | cbc:ForwarderServiceInstructions | cbc:Frequency | cbc:FundingProgram | cbc:HandlingInstructions | cbc:HashAlgorithmMethod | cbc:HaulageInstructions | cbc:HeatingType | cbc:Information | cbc:InhouseMail | cbc:InstructionNote | cbc:Instructions | cbc:InvoicingPartyReference | cbc:JobTitle | cbc:Justification | cbc:JustificationDescription | cbc:Keyword | cbc:LatestMeterReadingMethod | cbc:LegalReference | cbc:LimitationDescription | cbc:Line | cbc:ListValue | cbc:Location | cbc:Login | cbc:LossRisk | cbc:LowTendersDescription | cbc:MarkAttention | cbc:MarkCare | cbc:MaximumValue | cbc:MeterConstant | cbc:MeterName | cbc:MeterNumber | cbc:MeterReadingComments | cbc:MeterReadingType | cbc:MinimumImprovementBid | cbc:MinimumValue | cbc:MonetaryScope | cbc:MovieTitle | cbc:NameSuffix | cbc:NegotiationDescription | cbc:Note | cbc:OneTimeChargeType | cbc:OptionsDescription | cbc:OrderableUnit | cbc:OrganizationDepartment | cbc:OutstandingReason | cbc:PackingMaterial | cbc:PartyType | cbc:Password | cbc:PayPerView | cbc:PaymentDescription | cbc:PaymentNote | cbc:PersonalSituation | cbc:PhoneNumber | cbc:PlacardEndorsement | cbc:PlacardNotation | cbc:PlotIdentification | cbc:PostalZone | cbc:Postbox | cbc:PreviousMeterReadingMethod | cbc:PriceChangeReason | cbc:PriceRevisionFormulaDescription | cbc:PriceType | cbc:PrintQualifier | cbc:Priority | cbc:PrizeDescription | cbc:ProcessDescription | cbc:ProcessReason | cbc:Rank | cbc:Reference | cbc:Region | cbc:RegistrationNationality | cbc:RejectReason | cbc:Remarks | cbc:ReplenishmentOwnerDescription | cbc:ResidenceType | cbc:Resolution | cbc:RoleDescription | cbc:Room | cbc:SealingPartyType | cbc:ServiceNumberCalled | cbc:ServiceType | cbc:ShippingMarks | cbc:ShipsRequirements | cbc:SignatureMethod | cbc:SpecialInstructions | cbc:SpecialServiceInstructions | cbc:SpecialTerms | cbc:SpecialTransportRequirements | cbc:StatusReason | cbc:SubscriberType | cbc:SummaryDescription | cbc:TariffDescription | cbc:TaxExemptionReason | cbc:TechnicalCommitteeDescription | cbc:TelecommunicationsServiceCall | cbc:TelecommunicationsServiceCategory | cbc:TelecommunicationsSupplyType | cbc:Telefax | cbc:Telephone | cbc:TestMethod | cbc:Text | cbc:TierRange | cbc:TimeAmount | cbc:TimezoneOffset | cbc:TimingComplaint | cbc:Title | cbc:TradingRestrictions | cbc:TransportServiceProviderSpecialTerms | cbc:TransportUserSpecialTerms | cbc:TransportationServiceDescription | cbc:ValidateProcess | cbc:ValidateTool | cbc:ValidateToolVersion | cbc:Value | cbc:ValueQualifier | cbc:WarrantyInformation | cbc:Weight | cbc:WorkPhase | cbc:XPath"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="not(../(* except current())[name(.) = name(current())][not(@languageID)])"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="not(../(* except current())[name(.) = name(current())][not(@languageID)])">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text> &gt;La regla UBL [IND8] indica que dos elementos hermanos no pueden omitir informar el atributo languageID= </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M20"/>
   </xsl:template>
   <xsl:template match="text()" priority="-1" mode="M20"/>
   <xsl:template match="@*|node()" priority="-2" mode="M20">
      <xsl:apply-templates select="*" mode="M20"/>
   </xsl:template>
   <!--PATTERN UBL-model-->
   <xsl:variable name="rootLine"
                 select="if (boolean(/Invoice)) then 'cac:InvoiceLine' else if (boolean(/CreditNote)) then 'cac:CreditNoteLine' else if (boolean(/DebitNote)) then 'cac:DebitNoteLine' else ''"/>
   <!--RULE -->
   <xsl:template match="ext:UBLExtensions" priority="1035" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="ext:UBLExtensions"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(../ext:UBLExtensions)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(../ext:UBLExtensions)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA02]-XML no cumple con las personalizaciones de UBL-DIAN</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="not(count(//sts:DianExtensions) &gt; 1)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="not(count(//sts:DianExtensions) &gt; 1)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA03]-Solamente puede haber una ocurrencia de un grupo UBLExtension conteniendo el grupo sts:DianExtensions</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="not(count(//ds:Signature) &gt; 1)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="not(count(//ds:Signature) &gt; 1)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA04]-Solamente puede haber una ocurrencia de un grupo UBLExtension conteniendo el grupo ds:Signature</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ext:UBLExtension/ext:ExtensionContent/sts:DianExtensions)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ext:UBLExtension/ext:ExtensionContent/sts:DianExtensions)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA16]-XML no cumple con las personalizaciones de UBL-DIAN</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ext:UBLExtension/ext:ExtensionContent/ds:Signature)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ext:UBLExtension/ext:ExtensionContent/ds:Signature)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC01a]-No se encuentra el grupo ds:Signature</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="sts:DianExtensions" priority="1034" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="sts:DianExtensions"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:InvoiceAuthorization) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:InvoiceAuthorization) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA17]- (R) No se encuentra el numero de resolucion del rango de numeracion otorgado</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizationPeriod/cbc:StartDate) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizationPeriod/cbc:StartDate) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA18]- (R) No se encuentra la fecha de inicio del rango otorgado</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizationPeriod/cbc:EndDate) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizationPeriod/cbc:EndDate) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA19]- (R) No se encuentra la fecha de fin del rango otorgado</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizedInvoices/sts:From) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizedInvoices/sts:From) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA20]- (R) No se encuentra el numero inicial del rango otorgado</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizedInvoices/sts:To) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then exists(sts:InvoiceControl/sts:AuthorizedInvoices/sts:To) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA21]- (R) No se encuentra el numero final del rango otorgado</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(sts:SoftwareProvider/sts:ProviderID)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(sts:SoftwareProvider/sts:ProviderID)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA22]- (R) No se encuentra el NIT Proveedor tecnologico</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(sts:SoftwareProvider/sts:ProviderID/@schemeID)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(sts:SoftwareProvider/sts:ProviderID/@schemeID)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA23]- (R) No se encuentra el attributo schemeID del proveedor tecnologico</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(sts:SoftwareProvider/sts:SoftwareIDs)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(sts:SoftwareProvider/sts:SoftwareIDs)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA24]- (R) No se encuentra el codigo de software</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(sts:SoftwareSecurityCode)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(sts:SoftwareSecurityCode)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA25]- (R) No se encuentra el codigo de seguridad del software</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(sts:AuthorizationProvider/sts:AuthorizationProviderID)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(sts:AuthorizationProvider/sts:AuthorizationProviderID)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA26]- (R) No se encuentra el NIT de la DIAN</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(sts:QRCode)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(sts:QRCode)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA27]- (R) No se encuentra el campo con el valor del codigo QR</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="sts:ProviderID" priority="1033" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="sts:ProviderID"
                       role="fatal"/>
      <xsl:variable name="nitwithout" select="."/>
      <xsl:variable name="nitwithdv" select="concat(.,'-',@schemeID)"/>
      <xsl:variable name="a" select="substring($nitwithout,1,1)"/>
      <xsl:variable name="b" select="substring($nitwithout,2,1)"/>
      <xsl:variable name="c" select="substring($nitwithout,3,1)"/>
      <xsl:variable name="d" select="substring($nitwithout,4,1)"/>
      <xsl:variable name="e" select="substring($nitwithout,5,1)"/>
      <xsl:variable name="f" select="substring($nitwithout,6,1)"/>
      <xsl:variable name="g" select="substring($nitwithout,7,1)"/>
      <xsl:variable name="h" select="substring($nitwithout,8,1)"/>
      <xsl:variable name="i" select="substring($nitwithout,9,1)"/>
      <xsl:variable name="j"
                    select="(number($a) * 41) + (number($b) * 37) + (number($c) * 29) + (number($d) * 23) + (number($e) * 19) + (number($f) * 17) + (number($g) * 13) + (number($h) * 7) + (number($i) * 3)"/>
      <xsl:variable name="k" select="$j mod 11"/>
      <xsl:variable name="dv" select="if ($k &gt;= 2) then 11 - $k else $k"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then $dv = ./@schemeID else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then $dv = ./@schemeID else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD04b]-DV del NIT del Proveedor Tecnologico : '<xsl:text/>
                  <xsl:value-of select="@schemeID"/>
                  <xsl:text/>' no está correctamente calculado : '<xsl:text/>
                  <xsl:value-of select="$dv"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then exists(./@schemeID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then exists(./@schemeID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD05]- (R) NIT del Proveedor Tecnologico debe ser informado con dígito verificador (@schemeName debe ser “31”)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="sts:AuthorizationProviderID" priority="1032" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="sts:AuthorizationProviderID"
                       role="fatal"/>
      <xsl:variable name="nitwithout" select="."/>
      <xsl:variable name="nitwithdv"
                    select="concat(.,'-',sts:AuthorizationProviderID/@schemeID)"/>
      <xsl:variable name="a" select="substring($nitwithout,1,1)"/>
      <xsl:variable name="b" select="substring($nitwithout,2,1)"/>
      <xsl:variable name="c" select="substring($nitwithout,3,1)"/>
      <xsl:variable name="d" select="substring($nitwithout,4,1)"/>
      <xsl:variable name="e" select="substring($nitwithout,5,1)"/>
      <xsl:variable name="f" select="substring($nitwithout,6,1)"/>
      <xsl:variable name="g" select="substring($nitwithout,7,1)"/>
      <xsl:variable name="h" select="substring($nitwithout,8,1)"/>
      <xsl:variable name="i" select="substring($nitwithout,9,1)"/>
      <xsl:variable name="j"
                    select="(number($a) * 41) + (number($b) * 37) + (number($c) * 29) + (number($d) * 23) + (number($e) * 19) + (number($f) * 17) + (number($g) * 13) + (number($h) * 7) + (number($i) * 3)"/>
      <xsl:variable name="k" select="$j mod 11"/>
      <xsl:variable name="dv" select="if ($k &gt;= 2) then 11 - $k else $k"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then $dv = ./@schemeID else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then $dv = ./@schemeID else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD04b]-DV del NIT del Proveedor Autorizado : '<xsl:text/>
                  <xsl:value-of select="@schemeID"/>
                  <xsl:text/>' no está correctamente calculado : '<xsl:text/>
                  <xsl:value-of select="$dv"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then exists(./@schemeID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then exists(./@schemeID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD05]- (R) NIT del Proveedor Autorizado debe ser informado con dígito verificador (@schemeName debe ser “31”)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="ds:Signature" priority="1031" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="ds:Signature"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(ds:SignedInfo)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC02]- (R) El campo ds:SignedInfo esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:CanonicalizationMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:CanonicalizationMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC03]- (R) El campo ds:SignedInfo/ds:CanonicalizationMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:SignatureMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:SignatureMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC04]- (R) El campo ds:SignedInfo/ds:SignatureMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC05]- (R) El campo ds:SignedInfo/ds:Reference esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:Transforms)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:Transforms)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC06]- (R) El campo ds:SignedInfo/ds:Reference/ds:Transforms esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:Transforms/ds:Transform)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:Transforms/ds:Transform)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC07]- (R) El campo ds:SignedInfo/ds:Reference/ds:Transforms/ds:TransForm esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC08]- (R) El campo ds:SignedInfo/ds:Reference/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC09]- (R) El campo ds:SignedInfo/ds:Reference/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC10]- (R) El campo ds:SignedInfo/ds:Reference esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC11]- (R) El campo ds:SignedInfo/ds:Reference/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC12]- (R) El campo ds:SignedInfo/ds:Reference/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC13]- (R) El campo ds:SignedInfo/ds:Reference esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC14]- (R) El campo ds:SignedInfo/ds:Reference/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignedInfo/ds:Reference/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignedInfo/ds:Reference/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC15]- (R) El campo ds:SignedInfo/ds:Reference/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:SignatureValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:SignatureValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC16]- (R) El campo ds:SignatureValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:KeyInfo)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(ds:KeyInfo)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC17]- (R) El campo ds:KeyInfo esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:KeyInfo/ds:X509Data)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:KeyInfo/ds:X509Data)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC18]- (R) El campo ds:KeyInfo/ds:X509Data esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:KeyInfo/ds:X509Data/ds:X509Certificate)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:KeyInfo/ds:X509Data/ds:X509Certificate)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC19]- (R) El campo ds:KeyInfo/ds:X509Data/ds:X509Certificate esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(ds:Object)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC20]- (R) El campo ds:Object esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC21]- (R) El campo ds:Object/xades:QualifyingProperties esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC22]- (R) El campo ds:Object/xades:QualifyingProperties esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC23]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningTime)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningTime)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC24]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningTime esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC25]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC26]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC27]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC28]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC29]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC30]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC31]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC32]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC33]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC34]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC35]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC36]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC37]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC38]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC39]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC40]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC41]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC42]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC43]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC44]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC45]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC46]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC47]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC48]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyId)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyId)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC49]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyId esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyId/xades:Identifier)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyId/xades:Identifier)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC50]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyId/xades:Identifier esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC51]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash/ds:DigestMethod)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash/ds:DigestMethod)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC52]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash/ds:DigestMethod esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash/ds:DigestValue)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash/ds:DigestValue)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC53]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignaturePolicyIdentifier/xades:SignaturePolicyId/xades:SigPolicyHash/ds:DigestValue esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC54]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole/xades:ClaimedRoles)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole/xades:ClaimedRoles)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC55]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole/xades:ClaimedRoles esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole/xades:ClaimedRoles/xades:ClaimedRole)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole/xades:ClaimedRoles/xades:ClaimedRole)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DC56]- (R) El campo ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SignerRole/xades:ClaimedRoles/xades:ClaimedRole esta faltando</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cbc:UBLVersionID" priority="1030" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cbc:UBLVersionID"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test=". = 'UBL 2.1'"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test=". = 'UBL 2.1'">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA05]- (R) UBLVersionID : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' no contiene el literal “UBL 2.1”</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cbc:ProfileID" priority="1029" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cbc:ProfileID"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test=". = 'DIAN 2.0'"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test=". = 'DIAN 2.0'">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA07]- (R) ProfileID : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' no contiene el literal “DIAN 2.0”</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="sts:Prefix" priority="1028" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="sts:Prefix"
                       role="warning"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test=". = //cac:AccountingSupplierParty//cac:CorporateRegistrationScheme/cbc:ID"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test=". = //cac:AccountingSupplierParty//cac:CorporateRegistrationScheme/cbc:ID">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA10]- (R) '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' Debe ser igual al código de la sucursal correspondiente a este punto de facturación '<xsl:text/>
                  <xsl:value-of select="//cac:AccountingSupplierParty//cac:CorporateRegistrationScheme/cbc:ID"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="/descendant::cbc:ID[1]" priority="1027" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="/descendant::cbc:ID[1]"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="not(matches(., '\s')) and not(contains(., '-'))"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="not(matches(., '\s')) and not(contains(., '-'))">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA08a]- (R) Número de factura : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' contiene caracteres adicionales como espacios o guiones</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then number(substring-after(., //sts:Prefix)) &gt; number(//sts:From) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then number(substring-after(., //sts:Prefix)) &gt; number(//sts:From) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA08b]- (R) Número de factura : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' inferior al inicio del rango de numeración otorgado: '<xsl:text/>
                  <xsl:value-of select="//sts:From"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then number(substring-after(., //sts:Prefix)) &lt; number(//sts:To) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then number(substring-after(., //sts:Prefix)) &lt; number(//sts:To) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA08c]- (R) Número de factura : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' superior al final del rango de numeración otorgado: '<xsl:text/>
                  <xsl:value-of select="//sts:To"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="/descendant::cbc:IssueDate[1]" priority="1026" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="/descendant::cbc:IssueDate[1]"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="xs:dateTime(concat(., 'T', /descendant::cbc:IssueTime[1])) &lt; current-dateTime() + xs:dayTimeDuration('P10DT0H')"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="xs:dateTime(concat(., 'T', /descendant::cbc:IssueTime[1])) &lt; current-dateTime() + xs:dayTimeDuration('P10DT0H')">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA12b]- (R) Fecha de emision : '<xsl:text/>
                  <xsl:value-of select="concat(., 'T', /descendant::cbc:IssueTime[1])"/>
                  <xsl:text/>' es posterior a diez días calendario contados desde la fecha de transmisión del archivo para su validacón : '<xsl:text/>
                  <xsl:value-of select="current-dateTime()"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="xs:dateTime(concat(., 'T', /descendant::cbc:IssueTime[1])) &gt; current-dateTime() - xs:dayTimeDuration('P5DT0H')"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="xs:dateTime(concat(., 'T', /descendant::cbc:IssueTime[1])) &gt; current-dateTime() - xs:dayTimeDuration('P5DT0H')">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA12c]- (R) Fecha de emision : '<xsl:text/>
                  <xsl:value-of select="concat(., 'T', /descendant::cbc:IssueTime[1])"/>
                  <xsl:text/>' es anterior a cinco días calendario restados de la fecha actual : '<xsl:text/>
                  <xsl:value-of select="current-dateTime()"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then xs:date(.) &gt;= xs:date(//sts:InvoiceControl/sts:AuthorizationPeriod/cbc:StartDate) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then xs:date(.) &gt;= xs:date(//sts:InvoiceControl/sts:AuthorizationPeriod/cbc:StartDate) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA07]- (R) Fecha de emisión : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' anterior al la fecha de inicio de la autorización de la numeración : '<xsl:text/>
                  <xsl:value-of select="//sts:InvoiceControl/sts:AuthorizationPeriod/cbc:StartDate"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then xs:date(.) &lt;= xs:date(//sts:InvoiceControl/sts:AuthorizationPeriod/cbc:EndDate) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then xs:date(.) &lt;= xs:date(//sts:InvoiceControl/sts:AuthorizationPeriod/cbc:EndDate) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[DA08]- (R) Fecha de emisión :'<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' posterior al la fecha final de la autorización de la numeración : '<xsl:text/>
                  <xsl:value-of select="//sts:InvoiceControl/sts:AuthorizationPeriod/cbc:EndDate"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="/descendant::cbc:IssueTime[1]" priority="1025" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="/descendant::cbc:IssueTime[1]"
                       role="fatal"/>
      <xsl:variable name="hour" select="number(substring(.,1,2))"/>
      <xsl:variable name="minute" select="number(substring(.,4,2))"/>
      <xsl:variable name="second" select="number(substring(.,7,2))"/>
      <xsl:variable name="timezone" select="string(substring(.,9,6))"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="string-length(.)=14 and substring(.,3,1)=':' and substring(.,6,1)=':' and substring(.,9,6)='-05:00'"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="string-length(.)=14 and substring(.,3,1)=':' and substring(.,6,1)=':' and substring(.,9,6)='-05:00'">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA13a]- (R) Hora del envio : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' no esta en el formato autorizado HH:MM:SS-05-00</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="$hour&gt;=0 and $hour&lt;=23"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="$hour&gt;=0 and $hour&lt;=23">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA13b]- (R) Hora del envio : '<xsl:text/>
                  <xsl:value-of select="$hour"/>
                  <xsl:text/>' debe ser entre 0 y 23</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="$minute&gt;=0 and $minute&lt;=59"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="$minute&gt;=0 and $minute&lt;=59">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA13c]- (R) Minuto del envio : '<xsl:text/>
                  <xsl:value-of select="$minute"/>
                  <xsl:text/>' debe ser entre 0 y 59</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="$second&gt;=0 and $second&lt;=59"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="$second&gt;=0 and $second&lt;=59">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA13d]- (R) Minuto del envio : '<xsl:text/>
                  <xsl:value-of select="$second"/>
                  <xsl:text/>' debe ser entre 0 y 59</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="$timezone = '-05:00'"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="$timezone = '-05:00'">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA13e]- (R) Zona horaria del envio : '<xsl:text/>
                  <xsl:value-of select="$timezone"/>
                  <xsl:text/>' debe ser de Colombia (-05:00)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cbc:LineCountNumeric" priority="1024" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cbc:LineCountNumeric"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test=". = count(//cac:InvoiceLine) or . = count(//cac:CreditNoteLine) or . = count(//cac:DebitNoteLine)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test=". = count(//cac:InvoiceLine) or . = count(//cac:CreditNoteLine) or . = count(//cac:DebitNoteLine)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AA18]- (R) LineCountNumeric : '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' diferente del número de ocurrencias del grupo /Invoice/cac:InvoiceLine : '<xsl:text/>
                  <xsl:value-of select="count(//cac:InvoiceLine)"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:DiscrepancyResponse" priority="1023" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:DiscrepancyResponse"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:ReferenceID)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(cbc:ReferenceID)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HF02]- (N) : No se encuentra el prefijo y numero del documento referenciado</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:ResponseCode)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(cbc:ResponseCode)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HF02]- (N) : No se encuentra el codigo de razon de la nota.</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:AdditionalDocumentReference" priority="1022" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:AdditionalDocumentReference"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (/Invoice/cbc:InvoiceTypeCode = '03') then exists(cbc:ID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (/Invoice/cbc:InvoiceTypeCode = '03') then exists(cbc:ID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HH02]- (R)  : El prefijo y numero de la factura relacionada debe aparecer</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (/Invoice/cbc:InvoiceTypeCode = '03') then exists(cbc:UUID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (/Invoice/cbc:InvoiceTypeCode = '03') then exists(cbc:UUID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HH03]- (R)  : El CUFE de la factura relacionada debe aparecer</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:AccountingSupplierParty/cac:PartyTaxScheme//cbc:CompanyID"
                 priority="1021"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:AccountingSupplierParty/cac:PartyTaxScheme//cbc:CompanyID"
                       role="fatal"/>
      <xsl:variable name="nitwithout" select="."/>
      <xsl:variable name="nitwithdv"
                    select="concat(.,'-',cac:AccountingSupplierParty/cac:PartyTaxScheme//cbc:CompanyID/@schemeID)"/>
      <xsl:variable name="a" select="substring($nitwithout,1,1)"/>
      <xsl:variable name="b" select="substring($nitwithout,2,1)"/>
      <xsl:variable name="c" select="substring($nitwithout,3,1)"/>
      <xsl:variable name="d" select="substring($nitwithout,4,1)"/>
      <xsl:variable name="e" select="substring($nitwithout,5,1)"/>
      <xsl:variable name="f" select="substring($nitwithout,6,1)"/>
      <xsl:variable name="g" select="substring($nitwithout,7,1)"/>
      <xsl:variable name="h" select="substring($nitwithout,8,1)"/>
      <xsl:variable name="i" select="substring($nitwithout,9,1)"/>
      <xsl:variable name="j"
                    select="(number($a) * 41) + (number($b) * 37) + (number($c) * 29) + (number($d) * 23) + (number($e) * 19) + (number($f) * 17) + (number($g) * 13) + (number($h) * 7) + (number($i) * 3)"/>
      <xsl:variable name="k" select="$j mod 11"/>
      <xsl:variable name="dv" select="if ($k &gt;= 2) then 11 - $k else $k"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then $dv = ./@schemeID else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then $dv = ./@schemeID else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HC04]- (R) DV del NIT del emisor : '<xsl:text/>
                  <xsl:value-of select="@schemeID"/>
                  <xsl:text/>' no está correctamente calculado : '<xsl:text/>
                  <xsl:value-of select="$dv"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then exists(./@schemeID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then exists(./@schemeID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HC05]- (R) NIT del emisor debe ser informado con dígito verificador (si @schemeID es “31”)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:AccountingSupplierParty" priority="1020" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:AccountingSupplierParty"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:AdditionalAccountID)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:AdditionalAccountID)">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[EA02] (R) - No se encuentra el Tipo de organización</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cac:Party)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(cac:Party)">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[EA03] (R) - No se encuentra el grupo Party</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:AccountingCustomerParty/cac:PartyTaxScheme//cbc:CompanyID"
                 priority="1019"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:AccountingCustomerParty/cac:PartyTaxScheme//cbc:CompanyID"
                       role="fatal"/>
      <xsl:variable name="nitwithout" select="."/>
      <xsl:variable name="nitwithdv"
                    select="concat(.,'-',cac:AccountingCustomerParty/cac:PartyTaxScheme//cbc:CompanyID/@schemeID)"/>
      <xsl:variable name="a" select="substring($nitwithout,1,1)"/>
      <xsl:variable name="b" select="substring($nitwithout,2,1)"/>
      <xsl:variable name="c" select="substring($nitwithout,3,1)"/>
      <xsl:variable name="d" select="substring($nitwithout,4,1)"/>
      <xsl:variable name="e" select="substring($nitwithout,5,1)"/>
      <xsl:variable name="f" select="substring($nitwithout,6,1)"/>
      <xsl:variable name="g" select="substring($nitwithout,7,1)"/>
      <xsl:variable name="h" select="substring($nitwithout,8,1)"/>
      <xsl:variable name="i" select="substring($nitwithout,9,1)"/>
      <xsl:variable name="j"
                    select="(number($a) * 41) + (number($b) * 37) + (number($c) * 29) + (number($d) * 23) + (number($e) * 19) + (number($f) * 17) + (number($g) * 13) + (number($h) * 7) + (number($i) * 3)"/>
      <xsl:variable name="k" select="$j mod 11"/>
      <xsl:variable name="dv" select="if ($k &gt;= 2) then 11 - $k else $k"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then $dv = ./@schemeID else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then $dv = ./@schemeID else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD04b]-DV del NIT del adquiriente : '<xsl:text/>
                  <xsl:value-of select="@schemeID"/>
                  <xsl:text/>' no está correctamente calculado : '<xsl:text/>
                  <xsl:value-of select="$dv"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then exists(./@schemeID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then exists(./@schemeID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD05]- (R) NIT del adquiriente debe ser informado con dígito verificador (@schemeName debe ser “32”)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:AccountingSupplierParty" priority="1018" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:AccountingSupplierParty"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:AdditionalAccountID)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:AdditionalAccountID)">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[EA02] (R) - No se encuentra el Tipo de organización</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cac:Party)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(cac:Party)">
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[EA03] (R) - No se encuentra el grupo Party</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:DeliveryParty/cac:PartyTaxScheme//cbc:CompanyID"
                 priority="1017"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:DeliveryParty/cac:PartyTaxScheme//cbc:CompanyID"
                       role="fatal"/>
      <xsl:variable name="nitwithout" select="."/>
      <xsl:variable name="nitwithdv"
                    select="concat(.,'-',cac:DeliveryParty/cac:PartyTaxScheme//cbc:CompanyID/@schemeID)"/>
      <xsl:variable name="a" select="substring($nitwithout,1,1)"/>
      <xsl:variable name="b" select="substring($nitwithout,2,1)"/>
      <xsl:variable name="c" select="substring($nitwithout,3,1)"/>
      <xsl:variable name="d" select="substring($nitwithout,4,1)"/>
      <xsl:variable name="e" select="substring($nitwithout,5,1)"/>
      <xsl:variable name="f" select="substring($nitwithout,6,1)"/>
      <xsl:variable name="g" select="substring($nitwithout,7,1)"/>
      <xsl:variable name="h" select="substring($nitwithout,8,1)"/>
      <xsl:variable name="i" select="substring($nitwithout,9,1)"/>
      <xsl:variable name="j"
                    select="(number($a) * 41) + (number($b) * 37) + (number($c) * 29) + (number($d) * 23) + (number($e) * 19) + (number($f) * 17) + (number($g) * 13) + (number($h) * 7) + (number($i) * 3)"/>
      <xsl:variable name="k" select="$j mod 11"/>
      <xsl:variable name="dv" select="if ($k &gt;= 2) then 11 - $k else $k"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then $dv = ./@schemeID else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then $dv = ./@schemeID else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD04b]-DV del NIT del transportista : '<xsl:text/>
                  <xsl:value-of select="@schemeID"/>
                  <xsl:text/>' no está correctamente calculado : '<xsl:text/>
                  <xsl:value-of select="$dv"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then exists(./@schemeID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then exists(./@schemeID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD05]- (R) NIT del transportista debe ser informado con dígito verificador (@schemeName debe ser “32”)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:AllowanceCharge[not(ancestor::cac:InvoiceLine) or not(ancestor::cac:CreditNoteLine) or not(ancestor::cac:DebitNoteLine)]"
                 priority="1016"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:AllowanceCharge[not(ancestor::cac:InvoiceLine) or not(ancestor::cac:CreditNoteLine) or not(ancestor::cac:DebitNoteLine)]"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:ChargeIndicator) and cbc:ChargeIndicator = 'true' or cbc:ChargeIndicator = 'false'"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:ChargeIndicator) and cbc:ChargeIndicator = 'true' or cbc:ChargeIndicator = 'false'">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA02] (R) - Rechazo si este elemento contiene una información diferente de “true” o “false”</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:AllowanceChargeReason) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:AllowanceChargeReason) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA03] (R) - AllowanceChargeReason Obligatorio si es factura internacional</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:MultiplierFactorNumeric) and number(cbc:MultiplierFactorNumeric) &lt;= 100"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:MultiplierFactorNumeric) and number(cbc:MultiplierFactorNumeric) &lt;= 100">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA04] (N) -Notificación: si este elemento &gt; 100 </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (cbc:ChargeIndicator = false()) then number(cbc:Amount) &lt; number(cbc:BaseAmount) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (cbc:ChargeIndicator = false()) then number(cbc:Amount) &lt; number(cbc:BaseAmount) else true()">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA05] (N) -Notificación: si monto del descuento es superior al monto base del calculo del descuento</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then if (cbc:ChargeIndicator = false()) then exists(cbc:AllowanceChargeReasonCode) else true() else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then if (cbc:ChargeIndicator = false()) then exists(cbc:AllowanceChargeReasonCode) else true() else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA07] (R) - Obligatorio de informar si es descuento a nivel de factura.</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:TaxTotal[not(ancestor::cac:InvoiceLine) or not(ancestor::cac:CreditNoteLine) or not(ancestor::cac:DebitNoteLine)]"
                 priority="1015"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:TaxTotal[not(ancestor::cac:InvoiceLine) or not(ancestor::cac:CreditNoteLine) or not(ancestor::cac:DebitNoteLine)]"
                       role="fatal"/>
      <xsl:variable name="InvoicedQtyImpTimbre"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:InvoicedQuantity | //cac:CreditNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:CreditedQuantity | //cac:DebitNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:DebitedQuantity"/>
      <xsl:variable name="InvoicedQtyImpBolsa"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:InvoicedQuantity | //cac:CreditNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:CreditedQuantity | //cac:DebitNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:DebitedQuantity"/>
      <xsl:variable name="InvoicedQtyImpCarbono"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:InvoicedQuantity | //cac:CreditNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:CreditedQuantity | //cac:DebitNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:DebitedQuantity"/>
      <xsl:variable name="InvoicedQtyImpCombustible"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:InvoicedQuantity | //cac:CreditNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:CreditedQuantity | //cac:DebitNoteLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:DebitedQuantity"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible: <xsl:text/>
                  <xsl:value-of select="((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:Percent) div 100)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible: <xsl:text/>
                  <xsl:value-of select="((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:Percent) div 100)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible: <xsl:text/>
                  <xsl:value-of select="((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:Percent) div 100)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible: <xsl:text/>
                  <xsl:value-of select="((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxableAmount * ../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:Percent) div 100)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:PerUnitAmount * $InvoicedQtyImpBolsa))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:PerUnitAmount * $InvoicedQtyImpBolsa))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB07]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto de la cantidad de items vendidos aplicado sobre el impuesto unico por unidad: <xsl:text/>
                  <xsl:value-of select="((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:PerUnitAmount * $InvoicedQtyImpBolsa))"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:WithholdingTaxTotal" priority="1014" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:WithholdingTaxTotal"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount = sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount = sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount = sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount = sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount = sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount = sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:PaymentExchangeRate" priority="1013" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:PaymentExchangeRate"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:SourceCurrencyCode)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:SourceCurrencyCode)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M01] (R) - No se encuentra el campo cbc:SourceCurrencyCode</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="cbc:SourceCurrencyCode = //cbc:DocumentCurrencyCode"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="cbc:SourceCurrencyCode = //cbc:DocumentCurrencyCode">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M01] (R) - Rechazo si no es igual al elemento cbc:DocumentCurrencyCode</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="cbc:SourceCurrencyBaseRate = 1.00"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="cbc:SourceCurrencyBaseRate = 1.00">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M02] (R) - Rechazo si trae valor diferente a 1.00</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (//cbc:DocumentCurrencyCode != 'COP') then (cbc:TargetCurrencyCode = 'COP') else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (//cbc:DocumentCurrencyCode != 'COP') then (cbc:TargetCurrencyCode = 'COP') else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M03] (R) - Debe ir diligenciado en COP, si el cbc:DocumentCurrencyCode es diferente a COP</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="cbc:TargetCurrencyBaseRate = 1.00"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="cbc:TargetCurrencyBaseRate = 1.00">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M04] (R) - Rechazo si trae valor diferente a 1.00</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:CalculationRate)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:CalculationRate)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M05] (R) - No se encuentra el campo cbc:CalculationRate</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:Date)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="exists(cbc:Date)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[M06] (R) - No se encuentra el campo cbc:Date</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:LegalMonetaryTotal/cbc:LineExtensionAmount | cac:RequestedMonetaryTotal/cbc:LineExtensionAmount"
                 priority="1012"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:LegalMonetaryTotal/cbc:LineExtensionAmount | cac:RequestedMonetaryTotal/cbc:LineExtensionAmount"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = (sum(../../cac:InvoiceLine/cbc:LineExtensionAmount)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = (sum(../../cac:InvoiceLine/cbc:LineExtensionAmount)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB02]- (R) Valor bruto total de la factura antes de tributos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de los valores de las líneas de la factura que contienen valor comercial: <xsl:text/>
                  <xsl:value-of select="(sum(../..//cac:InvoiceLine/cbc:LineExtensionAmount))"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/CreditNote)) then . = (sum(../../cac:CreditNoteLine/cbc:LineExtensionAmount)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/CreditNote)) then . = (sum(../../cac:CreditNoteLine/cbc:LineExtensionAmount)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB02]- (R) Valor bruto total de la factura antes de tributos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de los valores de las líneas de la factura que contienen valor comercial: <xsl:text/>
                  <xsl:value-of select="(sum(../..//cac:InvoiceLine/cbc:LineExtensionAmount))"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/DebitNote)) then . = (sum(../../cac:DebitNoteLine/cbc:LineExtensionAmount)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/DebitNote)) then . = (sum(../../cac:DebitNoteLine/cbc:LineExtensionAmount)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB02]- (R) Valor bruto total de la factura antes de tributos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de los valores de las líneas de la factura que contienen valor comercial: <xsl:text/>
                  <xsl:value-of select="(sum(../..//cac:InvoiceLine/cbc:LineExtensionAmount))"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount | cac:RequestedMonetaryTotal/cbc:TaxExclusiveAmount"
                 priority="1011"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount | cac:RequestedMonetaryTotal/cbc:TaxExclusiveAmount"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = sum(../../cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = sum(../../cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB03]- (R) Base imponible para el cálculo de los tributos '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' diferente del valor bruto total de la factura, sumado a los cargos totales a la facutra, y restado de los descuentos totales a la factura : '<xsl:text/>
                  <xsl:value-of select="sum(../../cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount)"/>
                  <xsl:text/>'
    </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/CreditNote)) then . = sum(../../cac:CreditNoteLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/CreditNote)) then . = sum(../../cac:CreditNoteLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB03]- (R) Base imponible para el cálculo de los tributos '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' diferente del valor bruto total de la factura, sumado a los cargos totales a la facutra, y restado de los descuentos totales a la factura : '<xsl:text/>
                  <xsl:value-of select="sum(../../cac:CreditNoteLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount)"/>
                  <xsl:text/>'
    </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/DebitNote)) then . = sum(../../cac:DebitNoteLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/DebitNote)) then . = sum(../../cac:DebitNoteLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB03]- (R) Base imponible para el cálculo de los tributos '<xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/>' diferente del valor bruto total de la factura, sumado a los cargos totales a la facutra, y restado de los descuentos totales a la factura : '<xsl:text/>
                  <xsl:value-of select="sum(../../cac:DebitNoteLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount)"/>
                  <xsl:text/>'
    </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount | cac:RequestedMonetaryTotal/cbc:TaxInclusiveAmount"
                 priority="1010"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount | cac:RequestedMonetaryTotal/cbc:TaxInclusiveAmount"
                       role="fatal"/>
      <xsl:variable name="SumGlobalTaxFE"
                    select="sum(../..//cac:TaxTotal[not(ancestor::cac:InvoiceLine)]/cbc:TaxAmount)"/>
      <xsl:variable name="SumGlobalTaxNC"
                    select="sum(../..//cac:TaxTotal[not(ancestor::cac:CreditNoteLine)]/cbc:TaxAmount)"/>
      <xsl:variable name="SumGlobalTaxND"
                    select="sum(../..//cac:TaxTotal[not(ancestor::cac:DebitNoteLine)]/cbc:TaxAmount)"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then round(number(../cbc:LineExtensionAmount + $SumGlobalTaxFE)) = round(number(.)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then round(number(../cbc:LineExtensionAmount + $SumGlobalTaxFE)) = round(number(.)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB04]- (R) Monto Incluyendo Impuesto <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente del valor bruto total de la factura, sumado a los cargos totales a la facutra, y restado de los descuentos totales a la factura : <xsl:text/>
                  <xsl:value-of select="(../cbc:LineExtensionAmount + $SumGlobalTaxFE)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/CreditNote)) then round(number(../cbc:LineExtensionAmount + $SumGlobalTaxNC)) = round(number(.)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/CreditNote)) then round(number(../cbc:LineExtensionAmount + $SumGlobalTaxNC)) = round(number(.)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB04]- (R) Monto Incluyendo Impuesto <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente del valor bruto total de la factura, sumado a los cargos totales a la facutra, y restado de los descuentos totales a la factura : <xsl:text/>
                  <xsl:value-of select="(../cbc:LineExtensionAmount + $SumGlobalTaxFE)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/DebitNote)) then round(number(../cbc:LineExtensionAmount + $SumGlobalTaxND)) = round(number(.)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/DebitNote)) then round(number(../cbc:LineExtensionAmount + $SumGlobalTaxND)) = round(number(.)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB04]- (R) Monto Incluyendo Impuesto <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente del valor bruto total de la factura, sumado a los cargos totales a la facutra, y restado de los descuentos totales a la factura : <xsl:text/>
                  <xsl:value-of select="(../cbc:LineExtensionAmount + $SumGlobalTaxFE)"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount | cac:RequestedMonetaryTotal/cbc:AllowanceTotalAmount"
                 priority="1009"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount | cac:RequestedMonetaryTotal/cbc:AllowanceTotalAmount"
                       role="fatal"/>
      <xsl:variable name="SumTotalAllowanceFE"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:InvoiceLine)][cbc:ChargeIndicator = 'false']/cbc:Amount)"/>
      <xsl:variable name="SumTotalAllowanceNC"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:CreditNoteLine)][cbc:ChargeIndicator = 'false']/cbc:Amount)"/>
      <xsl:variable name="SumTotalAllowanceND"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:DebitNoteLine)][cbc:ChargeIndicator = 'false']/cbc:Amount)"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = $SumTotalAllowanceFE else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = $SumTotalAllowanceFE else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB05]- (R) Total descuentos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de todos los descuentos aplicados al total de la factura : <xsl:text/>
                  <xsl:value-of select="$SumTotalAllowanceFE"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = $SumTotalAllowanceNC else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = $SumTotalAllowanceNC else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB05]- (R) Total descuentos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de todos los descuentos aplicados al total de la factura : <xsl:text/>
                  <xsl:value-of select="$SumTotalAllowanceNC"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = $SumTotalAllowanceND else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = $SumTotalAllowanceND else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB05]- (R) Total descuentos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de todos los descuentos aplicados al total de la factura : <xsl:text/>
                  <xsl:value-of select="$SumTotalAllowanceND"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:LegalMonetaryTotal/cbc:ChargeTotalAmount | cac:RequestedMonetaryTotal/cbc:ChargeTotalAmount"
                 priority="1008"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:LegalMonetaryTotal/cbc:ChargeTotalAmount | cac:RequestedMonetaryTotal/cbc:ChargeTotalAmount"
                       role="fatal"/>
      <xsl:variable name="SumTotalChargeFE"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:InvoiceLine)][cbc:ChargeIndicator = 'true']/cbc:Amount)"/>
      <xsl:variable name="SumTotalChargeNC"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:CreditNoteLine)][cbc:ChargeIndicator = 'true']/cbc:Amount)"/>
      <xsl:variable name="SumTotalChargeND"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:DebitNoteLine)][cbc:ChargeIndicator = 'true']/cbc:Amount)"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = $SumTotalChargeFE else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = $SumTotalChargeFE else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB06]- (R) Total cargos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de todos los cargos aplicados al total de la factura : <xsl:text/>
                  <xsl:value-of select="$SumTotalChargeFE"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/CreditNote)) then . = $SumTotalChargeNC else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/CreditNote)) then . = $SumTotalChargeNC else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB06]- (R) Total cargos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de todos los cargos aplicados al total de la factura : <xsl:text/>
                  <xsl:value-of select="$SumTotalChargeNC"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/DebitNote)) then . = $SumTotalChargeND else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/DebitNote)) then . = $SumTotalChargeND else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB06]- (R) Total cargos <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de todos los cargos aplicados al total de la factura : <xsl:text/>
                  <xsl:value-of select="$SumTotalChargeND"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:LegalMonetaryTotal/cbc:PayableAmount | cac:RequestedMonetaryTotal/cbc:PayableAmount"
                 priority="1007"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:LegalMonetaryTotal/cbc:PayableAmount | cac:RequestedMonetaryTotal/cbc:PayableAmount"
                       role="fatal"/>
      <xsl:variable name="TaxInclusiveAmount" select="../..//cbc:TaxInclusiveAmount"/>
      <xsl:variable name="SumTotalAllowanceFE"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:InvoiceLine)][cbc:ChargeIndicator = 'false']/cbc:Amount)"/>
      <xsl:variable name="SumTotalAllowanceNC"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:InvoiceLine)][cbc:ChargeIndicator = 'false']/cbc:Amount)"/>
      <xsl:variable name="SumTotalAllowanceND"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:InvoiceLine)][cbc:ChargeIndicator = 'false']/cbc:Amount)"/>
      <xsl:variable name="SumTotalChargeFE"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:InvoiceLine)][cbc:ChargeIndicator = 'true']/cbc:Amount)"/>
      <xsl:variable name="SumTotalChargeNC"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:CreditNoteLine)][cbc:ChargeIndicator = 'true']/cbc:Amount)"/>
      <xsl:variable name="SumTotalChargeND"
                    select="sum(../..//cac:AllowanceCharge[not(ancestor::cac:DebitNoteLine)][cbc:ChargeIndicator = 'true']/cbc:Amount)"/>
      <xsl:variable name="PayableAmountFE"
                    select="format-number(xs:decimal($TaxInclusiveAmount - $SumTotalAllowanceFE + $SumTotalChargeFE),'#0.00')"/>
      <xsl:variable name="PayableAmountNC"
                    select="format-number(xs:decimal($TaxInclusiveAmount - $SumTotalAllowanceNC + $SumTotalChargeNC),'#0.00')"/>
      <xsl:variable name="PayableAmountND"
                    select="format-number(xs:decimal($TaxInclusiveAmount - $SumTotalAllowanceND + $SumTotalChargeND),'#0.00')"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then . = $PayableAmountFE else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then . = $PayableAmountFE else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB09]- (R) Total de la factura <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de Total valor bruto + Total Tributos - Total Tributo Retenidos - Anticipos (+/-) Redondeos : <xsl:text/>
                  <xsl:value-of select="$PayableAmountFE"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/CreditNote)) then . = $PayableAmountNC else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/CreditNote)) then . = $PayableAmountNC else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB09]- (R) Total de la factura <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de Total valor bruto + Total Tributos - Total Tributo Retenidos - Anticipos (+/-) Redondeos : <xsl:text/>
                  <xsl:value-of select="$PayableAmountNC"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/DebitNote)) then . = $PayableAmountND else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/DebitNote)) then . = $PayableAmountND else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[IB09]- (R) Total de la factura <xsl:text/>
                  <xsl:value-of select="."/>
                  <xsl:text/> diferente de la suma de Total valor bruto + Total Tributos - Total Tributo Retenidos - Anticipos (+/-) Redondeos : <xsl:text/>
                  <xsl:value-of select="$PayableAmountND"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:InvoiceLine | cac:CreditNoteLine | cac:DebitNoteLine"
                 priority="1006"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:InvoiceLine | cac:CreditNoteLine | cac:DebitNoteLine"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="count(cbc:ID) = count(distinct-values(cbc:ID))"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="count(cbc:ID) = count(distinct-values(cbc:ID))">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02a]- (N) Más de un grupo conteniendo el elemento /de:Invoice/de:InvoiceLine/cbc:ID con la misma información</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="count(cbc:ID) = 1"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl" test="count(cbc:ID) = 1">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02b]- (N) Los números de línea de factura utilizados en los diferentes grupos no son consecutivos, empezando con “1”</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:LineExtensionAmount)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:LineExtensionAmount)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02f]- (N) No se encuentra el campo cbc:LineExtensionAmount</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(cac:AllowanceCharge[cbc:ChargeIndiator = 'false']) and boolean(cac:AllowanceCharge[cbc:ChargeIndicator = 'true'])) then cbc:LineExtensionAmount = ((cac:Price/cbc:PriceAmount + cac:AllowanceCharge[cbc:ChargeIndicator = 'true']/cbc:Amount - cac:AllowanceCharge[cbc:ChargeIndicator = 'false']/cbc:Amount) * cac:Price/cbc:BaseQuantity) else if (boolean(cac:AllowanceCharge[cbc:ChargeIndiator = 'false'])) then cbc:LineExtensionAmount = ((cac:Price/cbc:PriceAmount - cac:AllowanceCharge[cbc:ChargeIndiator = 'false']/cbc:Amount) * cac:Price/cbc:BaseQuantity) else if (boolean(cac:AllowanceCharge[cbc:ChargeIndiator = 'true'])) then cbc:LineExtensionAmount = ((cac:Price/cbc:PriceAmount + cac:AllowanceCharge[cbc:ChargeIndiator = 'true']/cbc:Amount) * cac:Price/cbc:BaseQuantity) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(cac:AllowanceCharge[cbc:ChargeIndiator = 'false']) and boolean(cac:AllowanceCharge[cbc:ChargeIndicator = 'true'])) then cbc:LineExtensionAmount = ((cac:Price/cbc:PriceAmount + cac:AllowanceCharge[cbc:ChargeIndicator = 'true']/cbc:Amount - cac:AllowanceCharge[cbc:ChargeIndicator = 'false']/cbc:Amount) * cac:Price/cbc:BaseQuantity) else if (boolean(cac:AllowanceCharge[cbc:ChargeIndiator = 'false'])) then cbc:LineExtensionAmount = ((cac:Price/cbc:PriceAmount - cac:AllowanceCharge[cbc:ChargeIndiator = 'false']/cbc:Amount) * cac:Price/cbc:BaseQuantity) else if (boolean(cac:AllowanceCharge[cbc:ChargeIndiator = 'true'])) then cbc:LineExtensionAmount = ((cac:Price/cbc:PriceAmount + cac:AllowanceCharge[cbc:ChargeIndiator = 'true']/cbc:Amount) * cac:Price/cbc:BaseQuantity) else true()">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB04]- (N) Valor total de la línea, libre de tributos, diferente del producto de la cantidad por el precio unitario, considerados los cargos y los descuentos aplicados en esta línea</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cac:Item/cbc:Description)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cac:Item/cbc:Description)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02d]- (N) No se encuentra el campo cbc:Description</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (boolean(/Invoice)) then exists(cbc:FreeOfChargeIndicator) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (boolean(/Invoice)) then exists(cbc:FreeOfChargeIndicator) else true()">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02e]- (N) No se encuentra el campo cbc:FreeOfChargeIndicator</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cac:Price/cbc:PriceAmount)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cac:Price/cbc:PriceAmount)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02g]- (N) No se encuentra el campo cbc:PriceAmount</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:InvoicedQuantity) or exists(cbc:CreditedQuantity) or exists(cbc:DebitedQuantity)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:InvoicedQuantity) or exists(cbc:CreditedQuantity) or exists(cbc:DebitedQuantity)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02h]- (N) No se encuentra el campo cbc:InvoicedQuantity</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cac:Price/cbc:BaseQuantity)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cac:Price/cbc:BaseQuantity)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[AB02i]- (N) No se encuentra el campo cbc:BaseQuantity</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:InvoiceLine/cac:AllowanceCharge"
                 priority="1005"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:InvoiceLine/cac:AllowanceCharge"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:ChargeIndicator) and cbc:ChargeIndicator = 'true' or cbc:ChargeIndicator = 'false'"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:ChargeIndicator) and cbc:ChargeIndicator = 'true' or cbc:ChargeIndicator = 'false'">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA02] (R) - Rechazo si este elemento contiene una información diferente de “true” o “false”</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:AllowanceChargeReason) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:AllowanceChargeReason) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA03] (R) - AllowanceChargeReason Obligatorio si es factura internacional</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (cbc:ChargeIndicator = false()) then number(cbc:Amount) &lt;= number(cbc:BaseAmount) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (cbc:ChargeIndicator = false()) then number(cbc:Amount) &lt;= number(cbc:BaseAmount) else true()">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA05] (N) -Notificación: si monto del descuento es superior al monto base del calculo del descuento</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:MultiplierFactorNumeric)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:MultiplierFactorNumeric)">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA07] (R) -No se encuentra cbc:MultiplierFactorNumeric</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="number(cbc:MultiplierFactorNumeric) &lt;= 100"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="number(cbc:MultiplierFactorNumeric) &lt;= 100">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[JA07] (R) -Notificación: si cbc:MultiplierFactorNumeric : '<xsl:text/>
                  <xsl:value-of select="./cbc:MultiplierFactorNumeric"/>
                  <xsl:text/>' &gt; 100 </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:InvoiceLine/cac:TaxTotal | cac:CreditNoteLine/cac:TaxTotal | cac:DebitNoteLine/cac:TaxTotal"
                 priority="1004"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:InvoiceLine/cac:TaxTotal | cac:CreditNoteLine/cac:TaxTotal | cac:DebitNoteLine/cac:TaxTotal"
                       role="fatal"/>
      <xsl:variable name="InvoicedQtyImpTimbre"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:InvoicedQuantity"/>
      <xsl:variable name="InvoicedQtyImpBolsa"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:InvoicedQuantity"/>
      <xsl:variable name="InvoicedQtyImpCarbono"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:InvoicedQuantity"/>
      <xsl:variable name="InvoicedQtyImpCombustible"
                    select="//cac:InvoiceLine[cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:InvoicedQuantity"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '21']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '23']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24') then (round(../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount) = round(sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '24']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '01']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '02']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '03']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04') then (every $i in ../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '04']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:PerUnitAmount * $InvoicedQtyImpBolsa))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22') then (../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount = ((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:PerUnitAmount * $InvoicedQtyImpBolsa))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB07]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto de la cantidad de items vendidos aplicado sobre el impuesto unico por unidad: <xsl:text/>
                  <xsl:value-of select="((../cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '22']/cbc:PerUnitAmount * $InvoicedQtyImpBolsa))"/>
                  <xsl:text/>
               </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:InvoiceLine/cac:WithholdingTaxTotal"
                 priority="1003"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:InvoiceLine/cac:WithholdingTaxTotal"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (round(../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount) = round(sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (round(../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount) = round(sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (round(../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount) = round(sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (round(../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount) = round(sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (round(../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount) = round(sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount))) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (round(../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount) = round(sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount))) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB02]- (R) Valor total de un tributo : '<xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount"/>
                  <xsl:text/>' no corresponde a la suma de todas las informaciones correspondentes a cada una de las tarifas informadas en este documento para este tributo: '<xsl:text/>
                  <xsl:value-of select="sum(../cac:WithholdingTaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount)"/>
                  <xsl:text/>' </svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '05']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '06']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (../cac:WithholdingTaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07') then (every $i in ../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cac:TaxSubtotal satisfies $i/cbc:TaxAmount = (($i/cbc:TaxableAmount * $i/cac:TaxCategory/cbc:Percent) div 100)) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HB06]- (R) El valor del tributo correspondiente a una de las tarifas <xsl:text/>
                  <xsl:value-of select="../cac:WithholdingTaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID = '07']/cbc:TaxAmount"/>
                  <xsl:text/> es diferente del producto del porcentaje aplicado sobre la base imponible</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:Item" priority="1002" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:Item"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:BrandName) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:BrandName) else true()">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[FA05]- (N) Debe ser informada la marca del artículo en caso de factura internacional</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:ModelName) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if (/Invoice/cbc:InvoiceTypeCode = '02') then exists(cbc:ModelName) else true()">
               <xsl:attribute name="flag">warning</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[FA06]- (N) Debe ser informado el modelo del artículo en caso de factura internacional</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:PowerOfAttorney/cac:AgentParty/cac:PartyIdentification/cbc:ID"
                 priority="1001"
                 mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:PowerOfAttorney/cac:AgentParty/cac:PartyIdentification/cbc:ID"
                       role="fatal"/>
      <xsl:variable name="nitwithout" select="."/>
      <xsl:variable name="nitwithdv"
                    select="concat(.,'-',cac:PowerOfAttorney/cac:AgentParty/cac:PartyIdentification/cbc:ID/@schemeID)"/>
      <xsl:variable name="a" select="substring($nitwithout,1,1)"/>
      <xsl:variable name="b" select="substring($nitwithout,2,1)"/>
      <xsl:variable name="c" select="substring($nitwithout,3,1)"/>
      <xsl:variable name="d" select="substring($nitwithout,4,1)"/>
      <xsl:variable name="e" select="substring($nitwithout,5,1)"/>
      <xsl:variable name="f" select="substring($nitwithout,6,1)"/>
      <xsl:variable name="g" select="substring($nitwithout,7,1)"/>
      <xsl:variable name="h" select="substring($nitwithout,8,1)"/>
      <xsl:variable name="i" select="substring($nitwithout,9,1)"/>
      <xsl:variable name="j"
                    select="(number($a) * 41) + (number($b) * 37) + (number($c) * 29) + (number($d) * 23) + (number($e) * 19) + (number($f) * 17) + (number($g) * 13) + (number($h) * 7) + (number($i) * 3)"/>
      <xsl:variable name="k" select="$j mod 11"/>
      <xsl:variable name="dv" select="if ($k &gt;= 2) then 11 - $k else $k"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then $dv = ./@schemeID else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then $dv = ./@schemeID else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD04b]-DV del NIT Mandante : '<xsl:text/>
                  <xsl:value-of select="@schemeID"/>
                  <xsl:text/>' no está correctamente calculado : '<xsl:text/>
                  <xsl:value-of select="$dv"/>
                  <xsl:text/>'</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="if(@schemeName = '31') then exists(./@schemeID) else true()"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="if(@schemeName = '31') then exists(./@schemeID) else true()">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[HD05]- (R) NIT Mandante debe ser informado con dígito verificador (@schemeName debe ser “32”)</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <!--RULE -->
   <xsl:template match="cac:Price" priority="1000" mode="M21">
      <svrl:fired-rule xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                       context="cac:Price"
                       role="fatal"/>
      <!--ASSERT -->
      <xsl:choose>
         <xsl:when test="exists(cbc:BaseQuantity/@unitCode)"/>
         <xsl:otherwise>
            <svrl:failed-assert xmlns:svrl="http://purl.oclc.org/dsdl/svrl"
                                test="exists(cbc:BaseQuantity/@unitCode)">
               <xsl:attribute name="flag">fatal</xsl:attribute>
               <xsl:attribute name="location">
                  <xsl:apply-templates select="." mode="schematron-select-full-path"/>
               </xsl:attribute>
               <svrl:text>[FB04]- (R) La unidad de la cantidad utilizada no existe en la lista de unidades del apartado 6.3.6</svrl:text>
            </svrl:failed-assert>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
   <xsl:template match="text()" priority="-1" mode="M21"/>
   <xsl:template match="@*|node()" priority="-2" mode="M21">
      <xsl:apply-templates select="*" mode="M21"/>
   </xsl:template>
</xsl:stylesheet>
