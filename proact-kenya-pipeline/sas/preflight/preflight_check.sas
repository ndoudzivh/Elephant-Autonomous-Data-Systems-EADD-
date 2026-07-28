/*=============================================================================
  ProACT Kenya Pipeline - Preflight Check
  =============================================================================
  Purpose: Validate SAS Viya and CAS readiness before publishing model scores.
  - Verify CAS session connectivity
  - Verify target CASLib is accessible
  - Verify Denodo ODBC connectivity
  - Confirm model table structure expectations
  
  Parameters (injected via CI/CD environment variables):
    SYSPARM: ENV=<dev|uat|prod>&DESTINATION=<simulation|scenario_planning|operational>
  =============================================================================*/

%macro preflight_check();

    /* -----------------------------------------------------------------------
       Parse environment parameters
    ----------------------------------------------------------------------- */
    %let Env = %sysfunc(scan(%sysfunc(scan(&SYSPARM., 1, &)), 2, =));
    %let Destination = %sysfunc(scan(%sysfunc(scan(&SYSPARM., 2, &)), 2, =));

    %put NOTE: ========================================================;
    %put NOTE: ProACT Kenya - Preflight Check;
    %put NOTE: Environment: &Env.;
    %put NOTE: Destination: &Destination.;
    %put NOTE: ========================================================;

    /* -----------------------------------------------------------------------
       Environment-specific settings
    ----------------------------------------------------------------------- */
    %if &Env. = dev %then %do;
        %let DenodoDSN = Denodo_AR1_test;
        %let CasLibName = CAS_AR_CSE_Kenya_Dev;
    %end;
    %else %if &Env. = uat %then %do;
        %let DenodoDSN = Denodo_AR1_test;
        %let CasLibName = CAS_AR_CSE_Kenya_UAT;
    %end;
    %else %if &Env. = prod %then %do;
        %let DenodoDSN = Denodo_AR_Prod;
        %let CasLibName = CAS_AR_CSE_Kenya;
    %end;

    /* -----------------------------------------------------------------------
       Step 1: Start CAS session and verify connectivity
    ----------------------------------------------------------------------- */
    %put NOTE: Step 1 - Verifying CAS session connectivity...;

    cas mysas;

    %if &syserr. > 0 %then %do;
        %put ERROR: Failed to start CAS session. Aborting preflight.;
        %abort cancel 1;
    %end;

    %put NOTE: CAS session started successfully.;

    /* -----------------------------------------------------------------------
       Step 2: Assign CAS library and verify CASLib exists
    ----------------------------------------------------------------------- */
    %put NOTE: Step 2 - Verifying CASLib [&CasLibName.] accessibility...;

    libname mycas cas caslib="&CasLibName.";

    %if &syserr. > 0 %then %do;
        %put ERROR: CASLib [&CasLibName.] is not accessible. Check CAS library configuration.;
        cas mysas terminate;
        %abort cancel 2;
    %end;

    %put NOTE: CASLib [&CasLibName.] assigned successfully.;

    /* -----------------------------------------------------------------------
       Step 3: Verify Denodo ODBC connection
    ----------------------------------------------------------------------- */
    %put NOTE: Step 3 - Verifying Denodo ODBC connection [&DenodoDSN.]...;

    libname _tmpchk odbc datasrc="&DenodoDSN."
        schema=rsvrdpopsarlending
        user="&SYSUSERID."
        password="{SAS002}2A9EC31325E4A21B159AD9FE434A3AE850F29B5A2CA3B29E26263C1C5802B03A"
        dm_unicode="utf-16"
        PRESERVE_TAB_NAMES=YES;

    %if &syserr. > 0 %then %do;
        %put ERROR: Denodo ODBC connection failed for DSN [&DenodoDSN.]. Check credentials and network.;
        cas mysas terminate;
        %abort cancel 3;
    %end;

    %put NOTE: Denodo ODBC connection verified successfully.;
    libname _tmpchk clear;

    /* -----------------------------------------------------------------------
       Step 4: Verify CAS library is writable (test create/drop)
    ----------------------------------------------------------------------- */
    %put NOTE: Step 4 - Verifying write access to CASLib...;

    data mycas._preflight_test_;
        x = 1;
    run;

    %if &syserr. > 0 %then %do;
        %put ERROR: Cannot write to CASLib [&CasLibName.]. Check permissions.;
        cas mysas terminate;
        %abort cancel 4;
    %end;

    proc casutil;
        droptable casdata="_preflight_test_" incaslib="&CasLibName." quiet;
    run;

    %put NOTE: Write access to CASLib verified.;

    /* -----------------------------------------------------------------------
       Cleanup and success
    ----------------------------------------------------------------------- */
    libname mycas clear;
    cas mysas terminate;

    %put NOTE: ========================================================;
    %put NOTE: PREFLIGHT CHECK PASSED - All systems ready;
    %put NOTE: Environment: &Env. | Destination: &Destination.;
    %put NOTE: ========================================================;

%mend preflight_check;

%preflight_check();
