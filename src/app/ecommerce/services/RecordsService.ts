import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, tap, map, catchError, throwError } from "rxjs";
import { environment } from "src/environments/environment";
import { AuthGuard } from "src/app/guards/AuthGuardService";
import { IRecord } from "../EcommerceInterface";
import { StockService } from "./StockService";

@Injectable({
  providedIn: "root",
})
export class RecordsService {
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);
  private readonly stockService = inject(StockService);
  
  readonly urlAPI = environment.urlAPI;

  getRecords(): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http.get<IRecord[]>(`${this.urlAPI}records`, { headers }).pipe(
      map((response) => {
        // The API returns the array directly, no need to access .$values
        return Array.isArray(response) ? response : [];
      }),
      tap((records) => {
        records.forEach((record) => {
          this.stockService.notifyStockUpdate(record.idRecord, record.stock);
        });
      })
    );
  }

  addRecord(record: IRecord): Observable<IRecord> {
    const headers = this.getHeaders();
    const formData = new FormData();
    formData.append("titleRecord", record.titleRecord);
    if (record.yearOfPublication !== null) {
      formData.append("yearOfPublication", record.yearOfPublication.toString());
    } else {
      formData.append("yearOfPublication", "");
    }
    formData.append("photo", record.photo!);
    formData.append("price", record.price.toString());
    formData.append("stock", record.stock.toString());
    formData.append("discontinued", record.discontinued ? "true" : "false");
    formData.append("groupId", record.groupId?.toString()!);

    return this.http
      .post<any>(`${this.urlAPI}records`, formData, {
        headers,
      })
      .pipe(
        map((response) => {
          const newRecord = response.$values || {};
          return newRecord;
        }),
        tap((newRecord: IRecord) => {
          this.stockService.notifyStockUpdate(
            newRecord.idRecord,
            newRecord.stock
          );
        })
      );
  }

  updateRecord(record: IRecord): Observable<IRecord> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authGuard.getToken()}`,
    });
    const formData = new FormData();
    formData.append("titleRecord", record.titleRecord);
    if (record.yearOfPublication !== null) {
      formData.append("yearOfPublication", record.yearOfPublication.toString());
    } else {
      formData.append("yearOfPublication", "");
    }
    formData.append("price", record.price.toString());
    formData.append("stock", record.stock.toString());
    formData.append("discontinued", record.discontinued ? "true" : "false");
    formData.append("groupId", record.groupId?.toString()!);

    if (record.photo) {
      formData.append("photo", record.photo);
    }

    return this.http
      .put<any>(`${this.urlAPI}records/${record.idRecord}`, formData, {
        headers,
      })
      .pipe(
        map((response) => {
          const updatedRecord = response.$values || {};
          return updatedRecord;
        }),
        tap((updatedRecord: IRecord) => {
          this.stockService.notifyStockUpdate(
            updatedRecord.idRecord,
            updatedRecord.stock
          );
        })
      );
  }

  deleteRecord(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    return this.http
      .delete<any>(`${this.urlAPI}records/${id}`, {
        headers,
      })
      .pipe(
        map((response) => {
          const deletedRecord = response.$values || {};
          return deletedRecord;
        })
      );
  }

  getRecordsByGroup(idGroup: string | number): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.urlAPI}groups/recordsByGroup/${idGroup}`, { headers })
      .pipe(
        map((response) => {
          let records: IRecord[];
          let groupName = "";
          // Handle direct record array response
          if (Array.isArray(response)) {
            records = response;
          }
          // Handle $values wrapper
          else if (response && response.$values) {
            records = response.$values;
          }
          // Handle records nested in group response
          else if (
            response &&
            typeof response === "object" &&
            response.records
          ) {
            if (Array.isArray(response.records)) {
              records = response.records;
            } else if (response.records.$values) {
              records = response.records.$values;
            } else if (typeof response.records === "object") {
              records = Object.values(response.records).filter(
                (val): val is IRecord => {
                  if (!val || typeof val !== "object") return false;
                  const v = val as any;
                  return (
                    typeof v.idRecord === "number" &&
                    typeof v.titleRecord === "string" &&
                    typeof v.stock === "number"
                  );
                }
              );
            } else {
              records = [];
            }
          }
          // Handle single record response
          else if (
            response &&
            typeof response === "object" &&
            "idRecord" in response
          ) {
            records = [response];
          }
          // Handle other object responses
          else if (response && typeof response === "object") {
            const values = Object.values(response);
            records = values.filter((val): val is IRecord => {
              if (!val || typeof val !== "object") return false;
              const v = val as any;
              return (
                typeof v.idRecord === "number" &&
                typeof v.titleRecord === "string" &&
                typeof v.stock === "number"
              );
            });
          }
          // Default to empty array
          else {
            records = [];
          }

          // If the answer has the group name, save it.
          if (response && response.nameGroup) {
            groupName = response.nameGroup;
          } else if (
            response &&
            typeof response === "object" &&
            response.group &&
            response.group.nameGroup
          ) {
            groupName = response.group.nameGroup;
          }

          // Assign the group name to each record
          records.forEach((record) => {
            record.groupName = groupName || "";
          });

          return records;
        }),
        tap((records) => {
          records.forEach((record) => {
            if (record && record.idRecord && record.stock !== undefined) {
              this.stockService.notifyStockUpdate(
                record.idRecord,
                record.stock
              );
            }
          });
        })
      );
  }

  getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    });
  }

  decrementStock(idRecord: number): Observable<any> {
    const headers = this.getHeaders();
    const amount = -1;
    return this.http
      .put(
        `${this.urlAPI}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          this.stockService.notifyStockUpdate(idRecord, amount);
        })
      );
  }

  incrementStock(idRecord: number): Observable<any> {
    const headers = this.getHeaders();
    const amount = 1;
    return this.http
      .put(
        `${this.urlAPI}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          this.stockService.notifyStockUpdate(idRecord, amount);
        })
      );
  }

  getRecordById(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    return this.http
      .get<IRecord>(`${this.urlAPI}records/${id}`, { headers })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }
}
