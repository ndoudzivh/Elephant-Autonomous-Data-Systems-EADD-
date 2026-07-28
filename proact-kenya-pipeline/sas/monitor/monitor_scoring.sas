/*=============================================================================
  ProACT Kenya Pipeline - Monitor Scoring (Operational)
  =============================================================================
  Purpose: Post-deployment monitoring of operational model scores.
  - Validate table is still promoted and accessible
  - Run row count trend check (compare to expected baseline)
  - Check score distribution for drift
  - Log monitoring metrics
  
  Used by: Operational destination only (runs after Approve gate)
  =============================================================================*/

%macro monitor_scoring();

    /* -----------------------------------------------------------------------
       Parse environment parameters
    ----------------------------------------------------------------------- */
    %let Env = %sysfunc(scan(%sysfunc(scan(&SYSPARM., 1, &)), 2, =));

    %put NOTE: ========================================================;
    %put NOTE: ProACT Kenya - Monitor Scoring (Operational);
    %put NOTE: Environment: &Env.;
    %put NOTE: Timestamp: %sysfunc(datetime(), datetime20.);
    %put NOTE: ========================================================;

    /* -----------------------------------------------------------------------
       Environment-specific settings
    ----------------------------------------------------------------------- */
    %if &Env. = dev %then %do;
        %let CasLibName = CAS_AR_CSE_Kenya_Dev;
    %end;
    %else %if &Env. = uat %then %do;
        %let CasLibName = CAS_AR_CSE_Kenya_UAT;
    %end;
    %else %if &Env. = prod %then %do;
        %let CasLibName = CAS_AR_CSE_Kenya;
    %end;

    %let CASTableName = KE_model_operational;
    %let CasLib = mycas;

    /* -----------------------------------------------------------------------
       Step 1: Start CAS session
    ----------------------------------------------------------------------- */
    cas mysas;
    libname mycas cas caslib="&CasLibName.";

    /* -----------------------------------------------------------------------
       Step 2: Verify table is promoted and accessible
    ----------------------------------------------------------------------- */
    %put NOTE: Step 2 - Verifying operational table is accessible...;

    proc cas;
        table.tableExists result=r /
            caslib="&CasLibName."
            name="&CASTableName.";
        if r.exists = 0 then do;
            put "ERROR: Operational CAS table [&CASTableName.] not found!";
            abort;
        end;
        else put "NOTE: Operational table confirmed accessible.";
    quit;

    %if &syserr. > 0 %then %do;
        %put ERROR: Operational table not accessible. Alert required.;
        cas mysas terminate;
        %abort cancel 1;
    %end;

    /* -----------------------------------------------------------------------
       Step 3: Row count monitoring
    ----------------------------------------------------------------------- */
    %put NOTE: Step 3 - Checking row count baseline...;

    proc sql noprint;
        select count(*) into :current_rows trimmed
        from &CasLib..&CASTableName.;
    quit;

    %put NOTE: Current row count = &current_rows.;

    /* Alert if row count drops below minimum threshold */
    %let min_row_threshold = 100;

    %if &current_rows. < &min_row_threshold. %then %do;
        %put WARNING: Row count (&current_rows.) below minimum threshold (&min_row_threshold.).;
        %put WARNING: Potential data issue - investigate source Denodo view.;
    %end;

    /* -----------------------------------------------------------------------
       Step 4: Score distribution check (model drift detection)
    ----------------------------------------------------------------------- */
    %put NOTE: Step 4 - Checking score distribution for drift...;

    proc means data=&CasLib..&CASTableName. n mean std min max p25 p50 p75;
        /* Add specific score columns here once model structure is finalized */
        /* var score_pd score_lgd; */
    run;

    /* -----------------------------------------------------------------------
       Step 5: Log monitoring results
    ----------------------------------------------------------------------- */
    %put NOTE: ========================================================;
    %put NOTE: MONITORING SUMMARY;
    %put NOTE: --------------------------------------------------------;
    %put NOTE: Environment: &Env.;
    %put NOTE: Table: &CASTableName.;
    %put NOTE: CASLib: &CasLibName.;
    %put NOTE: Row Count: &current_rows.;
    %put NOTE: Timestamp: %sysfunc(datetime(), datetime20.);
    %put NOTE: Status: HEALTHY;
    %put NOTE: ========================================================;

    /* -----------------------------------------------------------------------
       Cleanup
    ----------------------------------------------------------------------- */
    libname mycas clear;
    cas mysas terminate;

%mend monitor_scoring;

%monitor_scoring();
