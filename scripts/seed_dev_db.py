# Connection test: Verifies laptop can connect to PostgreSQL. (We will add automatic framework importing later)

import sys

import psycopg2  # to send queries to postgreSQL databases


def verify_connections():
    print("Initializing local dependency diagnostics...")
    try:
        # 1.Open the Database Gateway
        # This attempts to create a network connection stream to port 5432 on localhost using the exact credentials configured inside the local docker-compose.yml file.
        conn = psycopg2.connect(
            dbname="grc_platform",
            user="grc_user",
            password="grc_local_password_123",
            host="localhost",
            port="5432",
        )
        cursor = (
            conn.cursor()
        )  # helps writing, submitting queries and go through responses row by row
        cursor.execute("SELECT version();")  # for checking
        db_version = cursor.fetchone()
        print(f"PostgreSQL Connection: OK (Version: {db_version[0]})")
        cursor.close()
        conn.close()
    except psycopg2.Error as e:
        print(f"PostgreSQL Connection: FAILED ({e})")
        sys.exit(1)


if __name__ == "__main__":
    verify_connections()
