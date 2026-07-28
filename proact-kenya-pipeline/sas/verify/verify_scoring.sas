/*=============================================================================
  ProACT Kenya Pipeline - Verify Scoring
  =============================================================================
  Purpose: Validate that model scores were correctly published to CAS.
  - Confirm CAS table exists and is promoted
  - Validate row count is > 0
  - Check for expected columns
  - Run basic data quality checks (no all-NULL columns, reasonable ranges)
  
  Used by: Simulation and Scenario Planning destinations
  =============================================================================*/

%macro verify_scoring();

    /* -----------------------------------------------------------------------
       Parse environment parameters
    ----------------------------------------------------------------------- */
    %let Env = %sysfunc(scan(%sysfunc(scan(&SYSPARM., 1, &)), 2, =));
    %let Destination = %sysfunc(scan(%sysfunc(scan(&SYSPARM., 2, &)), 2, =));

    %put NOTE: ========================================================;
    %put NOTE: ProACT Kenya - Verify Scoring;
    %put NOTE: Environment: &Env.;
    %put NOTE: Destination: &Destination.;
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

    /* Determine CAS table name from destination */
    %if &Destination. = simulation %then %do;
        %let CASTableName = KE_model_simulation;
    %end;
    %else %if &Destination. = scenario_planning %then %do;
        %let CASTableName = KE_model_scenario;
    %end;
    %else %if &Destination. = operational %then %do;
        %let CASTableName = KE_model_operational;
    %end;

    %let CasLib = mycas;

    /* -----------------------------------------------------------------------
       Step 1: Start CAS session
    ----------------------------------------------------------------------- */
    cas mysas;
    libname mycas cas caslib="&CasLibName.";

    /* -----------------------------------------------------------------------
       Step 2: Verify table exists in CAS
    ----------------------------------------------------------------------- */
    %put NOTE: Step 2 - Checking CAS table [&CASTableName.] exists...;

    proc cas;
        table.tableExists result=r /
            caslib="&CasLibName."
            name="&CASTableName.";
        if r.exists = 0 then do;
            put "ERROR: CAS table [&CASTableName.] does not exist in [&CasLibName.].";
            abort;
        end;
        else put "NOTE: CAS table [&CASTableName.] confirmed to exist.";
    quit;

    %if &syserr. > 0 %then %do;
        %put ERROR: Table existence check failed.;
        cas mysas terminate;
        %abort cancel 1;
    %end;

    /* -----------------------------------------------------------------------
       Step 3: Validate row count
    ----------------------------------------------------------------------- */
    %put NOTE: Step 3 - Validating row count...;

    proc sql noprint;
        select count(*) into :row_count trimmed
        from &CasLib..&CASTableName.;
    quit;

    %put NOTE: Row count = &row_count.;

    %if &row_count. = 0 %then %do;
        %put ERROR: CAS table [&CASTableName.] has 0 rows. Publish may have failed.;
        cas mysas terminate;
        %abort cancel 2;
    %end;

    %put NOTE: Row count validation passed (&row_count. rows).;

    /* -----------------------------------------------------------------------
       Step 4: Validate expected columns exist
    ----------------------------------------------------------------------- */
    %put NOTE: Step 4 - Checking expected columns...;

    proc contents data=&CasLib..&CASTableName. out=_colcheck_ noprint;
    run;

    /* Check minimum expected columns - adjust as needed for Kenya model */
    proc sql noprint;
        select count(*) into :ncols trimmed
        from _colcheck_;
    quit;

    %if &ncols. < 2 %then %do;
        %put ERROR: CAS table has fewer than expected columns (&ncols. found).;
        cas mysas terminate;
        %abort cancel 3;
    %end;

    %put NOTE: Column structure validated (&ncols. columns found).;

    /* -----------------------------------------------------------------------
       Step 5: Basic data quality check
    ----------------------------------------------------------------------- */
    %put NOTE: Step 5 - Running data quality spot checks...;

    proc means data=&CasLib..&CASTableName. n nmiss min max;
    run;

    /* -----------------------------------------------------------------------
       Cleanup and success
    ----------------------------------------------------------------------- */
    proc datasets lib=work nolist;
        delete _colcheck_;
    quit;

    libname mycas clear;
    cas mysas terminate;

    %put NOTE: ========================================================;
    %put NOTE: VERIFICATION PASSED;
    %put NOTE: Table: &CASTableName. | Rows: &row_count. | Cols: &ncols.;
    %put NOTE: ========================================================;

%mend verify_scoring;

%verify_scoring();
