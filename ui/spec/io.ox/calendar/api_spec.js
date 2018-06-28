/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */
define(['io.ox/calendar/api'], function (api) {

    'use strict';

    describe('Calendar API', function () {

        var HOUR = 1000 * 60 * 60,
            DAY = HOUR * 24,
            WEEK = DAY * 7;

        function getDatetime(timestamp) {
            return {
                value: moment(timestamp).format('YYYYMMDD[T]HHmmss'),
                tzid: 'Europe/Berlin'
            };
        }

        beforeEach(function () {
            // mark all collections as expired
            api.pool.gc();
            // cleanup pool
            api.pool.gc();
        });

        it('should return a new collection with models from other collections in that range', function () {
            // fill pool with collections
            var c1, c2, m1, m2, m3;
            c1 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2'], view: 'week' });
            c1.reset([
                m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) },
                m2 = { id: '2', cid: 'f2.2', folder: 'f2', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) }
            ], { silent: true });
            c2 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f3'], view: 'week' });
            c2.reset([
                m1,
                m3 = { id: '3', cid: 'f3.3', folder: 'f3', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) }
            ], { silent: true });

            c1.toJSON().should.deep.equal([m1, m2]);
            c2.toJSON().should.deep.equal([m1, m3]);

            var c3 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f3', 'f4'], view: 'week' });
            c3.toJSON().should.deep.equal([m1, m3]);
        });


        describe('pool', function () {
            it('should get collection by folder id', function () {
                api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2', 'f3'], view: 'week' });
                api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f4'], view: 'week' });
                api.getCollection({ start: 0, end: WEEK, folders: ['f2', 'f3'], view: 'week' });

                var collections = api.pool.getByFolder('f1');
                collections.should.have.length(2);
                collections[0].cid.should.equal('start=0&end=604800000&folders=["f1","f2","f3"]&view=week');
                collections[1].cid.should.equal('start=0&end=604800000&folders=["f1","f4"]&view=week');
            });

            it('should get a list of collections by a model cid', function () {
                var c1, c2, m1;
                c1 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2'], view: 'week' });
                c1.reset([
                    m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) },
                    { id: '2', cid: 'f2.2', folder: 'f2', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) }
                ], { silent: true });
                c2 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f3'], view: 'week' });
                c2.reset([
                    m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) },
                    { id: '3', cid: 'f2.3', folder: 'f2', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) }
                ], { silent: true });
                api.getCollection({ start: WEEK, end: 2 * WEEK, folders: ['f1', 'f2'], view: 'week' });

                var collections = api.pool.getCollectionsByCID(m1.cid);
                collections.should.have.length(2);
                collections[0].cid.should.equal('start=0&end=604800000&folders=["f1","f2"]&view=week');
                collections[1].cid.should.equal('start=0&end=604800000&folders=["f1","f3"]&view=week');
            });

            it('should return a list of collections containing a specific model', function () {
                var c1, c2, m1;
                c1 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2'], view: 'week' });
                c1.reset([
                    m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) },
                    { id: '2', cid: 'f2.2', folder: 'f2', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) }
                ], { silent: true });
                c2 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f3'], view: 'week' });
                c2.reset([
                    m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) },
                    { id: '3', cid: 'f2.3', folder: 'f2', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) }
                ], { silent: true });
                api.getCollection({ start: WEEK, end: 2 * WEEK, folders: ['f1', 'f2'], view: 'week' });

                var collections = api.pool.getCollectionsByModel(m1);
                collections.should.have.length(2);
                collections[0].cid.should.equal('start=0&end=604800000&folders=["f1","f2"]&view=week');
                collections[1].cid.should.equal('start=0&end=604800000&folders=["f1","f3"]&view=week');
            });

            it('should propagate changes', function () {
                var c1 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2'], view: 'week' }),
                    c2 = api.getCollection({ start: 0, end: 4 * WEEK, folders: ['f1', 'f2'], view: 'month' }),
                    c3 = api.getCollection({ start: WEEK, end: 2 * WEEK, folders: ['f1', 'f2'], view: 'week' }),
                    c4 = api.getCollection({ start: 0, end: WEEK, folders: ['f2'], view: 'week' }),
                    m1;

                c1.should.have.length(0);
                c2.should.have.length(0);
                c3.should.have.length(0);
                c4.should.have.length(0);

                api.pool.propagateAdd(m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) });

                c1.toJSON().should.deep.equal([m1]);
                c2.toJSON().should.deep.equal([m1]);
                c3.should.have.length(0);
                c4.should.have.length(0);

                api.pool.propagateUpdate(m1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(2 * HOUR), endDate: getDatetime(3 * HOUR) });

                c1.toJSON().should.deep.equal([m1]);
                c2.toJSON().should.deep.equal([m1]);
                c3.should.have.length(0);
                c4.should.have.length(0);
            });

            describe('should return a backbone model of the pool when receiving a json object', function () {

                it('without collections in pool from the detail collection', function () {
                    var d1, m1;
                    m1 = api.pool.getModel(d1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) });

                    api.pool.getCollections().detail.collection.toJSON().should.deep.equal([d1]);
                    m1.toJSON().should.deep.equal(d1);
                });

                it('with collections in pool', function () {
                    var c1 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2'], view: 'week' }),
                        d1, m1;
                    c1.reset([
                        d1 = { id: '1', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) }
                    ], { silent: true });
                    m1 = api.pool.getModel(d1);

                    api.pool.getCollections().detail.collection.should.have.length(0);
                    m1.toJSON().should.deep.equal(d1);
                });

            });

            it('should find all recurring appointments of a series', function () {
                var c1 = api.getCollection({ start: 0, end: WEEK, folders: ['f1', 'f2'], view: 'week' }),
                    c2 = api.getCollection({ start: WEEK, end: 2 * WEEK, folders: ['f1', 'f2'], view: 'week' }),
                    c3 = api.getCollection({ start: 2 * WEEK, end: 3 * WEEK, folders: ['f1', 'f2'], view: 'week' }),
                    m1, m2, m3;

                c1.reset([
                    m1 = { id: '1', seriesId: '0', cid: 'f1.1', folder: 'f1', startDate: getDatetime(HOUR), endDate: getDatetime(2 * HOUR) }
                ], { silent: true });
                c2.reset([
                    m2 = { id: '2', seriesId: '0', cid: 'f1.2', folder: 'f1', startDate: getDatetime(WEEK + HOUR), endDate: getDatetime(WEEK + 2 * HOUR) }
                ], { silent: true });
                c3.reset([
                    m3 = { id: '3', seriesId: '0', cid: 'f1.3', folder: 'f1', startDate: getDatetime(2 * WEEK + HOUR), endDate: getDatetime(2 * WEEK + 2 * HOUR) }
                ], { silent: true });

                _(api.pool.findRecurrenceModels({ id: '0', folder: 'f1' })).invoke('toJSON').should.deep.equal([m1, m2, m3]);
            });
        });

    });

});
